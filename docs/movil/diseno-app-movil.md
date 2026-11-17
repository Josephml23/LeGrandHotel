# LeGrandHotel Móvil — diseño de la aplicación para Android e iOS

Estado: **código y APK de depuración hechos; iOS sin compilar**. La app está en `mobile/` (Flutter 3.47, Dart 3.13).
- Hecho y verificado en este equipo (Windows): `flutter analyze` sin errores, `flutter test` con 38 pruebas en verde,
  `flutter build apk --debug` correcto (APK de 163 MB, normal en depuración).
- No verificado: instalar y correr el APK en un emulador o teléfono contra la API real; compilación de release o
  AppBundle firmados para tienda; todo lo de iOS (no hay Mac con Xcode).
- Pendiente / no incluido todavía: notificaciones push, login con Google en la app, cabecera `X-App-Version`,
  desbloqueo con huella o rostro, certificate pinning, flujo de CI para `mobile/`, pruebas E2E.

Este documento describe lo construido. Donde el diseño original (de React Native) no se implementó, queda marcado
como «pendiente / no incluido todavía».

## 1. Objetivo

Llevar al teléfono del **personal del hotel** las tareas que se hacen lejos de un escritorio, usando **la misma API**
(`/api/v1`) que la página web. Igual que la web, es una herramienta **interna**: no tiene registro público y ningún
huésped ni persona externa puede entrar; las cuentas las crea el Administrador. La app no reemplaza a la web: cubre
lo que conviene hacer en movimiento.

| Usuario | Para qué usa la app |
| --- | --- |
| Recepcionista | Ver las llegadas y salidas del día, hacer check-in y check-out, registrar la reserva de un huésped que llega o llama, cambiar el estado de una habitación, registrar la placa en la cochera |
| Almacenero | Registrar entradas y salidas de inventario y ver los insumos bajo el mínimo |
| Administrador | Ver todas las pestañas: recepción, almacén, el panel resumido (ocupación, ingresos del mes) y la cuenta. La gestión completa (personal, usuarios, reportes) sigue en la web |
| Programador | Ver el panel resumido (sin el resumen de ocupación, que es solo del Administrador). Lo demás, en la vista web `/programador` |

Los clientes (rol `client`) entran solo con Google en la web. La app **rechaza** sus cuentas al iniciar sesión.

## 2. Tecnología elegida: Flutter (Dart)

Se eligió **Flutter** porque lo pidió el usuario el 16/11/2026. Reemplaza la elección anterior de este documento
(React Native con Expo), que queda descartada.

| Opción | Ventajas | Desventajas | Decisión |
| --- | --- | --- | --- |
| **Flutter** | Un solo código para Android e iOS; buen rendimiento y diseño consistente; herramientas de compilación y pruebas integradas | Otro lenguaje (Dart): no se reutilizan tipos ni código TypeScript de la web | **Elegida** (pedida por el usuario) |
| React Native + Expo | Un solo código para Android e iOS; React y TypeScript como la web; compila en la nube (EAS Build) | Algunas funciones nativas requieren módulos propios | **Descartada** (era la elección original del diseño) |
| Nativo (Kotlin + Swift) | Máximo acceso al sistema | Dos aplicaciones separadas, el doble de trabajo para un equipo pequeño | Descartada |
| PWA (la web instalable) | Cero código nuevo | Notificaciones y almacenamiento seguro limitados en iOS; no está en las tiendas | Complemento, no reemplazo |

Paquetes reales (versiones fijadas en `mobile/pubspec.lock`):

| Necesidad | Paquete | Versión | Uso en la app |
| --- | --- | --- | --- |
| Llamadas HTTP a la API | `dio` | 5.11.1 | Cliente en `lib/core/api/api_client.dart` con interceptores |
| Estado y dependencias | `flutter_riverpod` | 3.5.0 | `ProviderScope` en `main.dart`; `AuthController` y proveedores de cada pantalla |
| Navegación por rutas | `go_router` | 18.1.4 | Rutas de login, splash y errores en `lib/core/router.dart` |
| Token en almacenamiento seguro | `flutter_secure_storage` | 11.2.0 | Keychain (iOS) y Keystore (Android), en `lib/core/auth/session_store.dart` |
| Iconos | `cupertino_icons` | 1.0.8 | Iconos de estilo iOS, por la plantilla de Flutter |
| Lints | `flutter_lints` | 6.0.0 | Análisis estático (`analysis_options.yaml`) |

Librerías del diseño original que **no se usan** (eran de React Native/Expo): Expo Router, TanStack Query, Axios,
`expo-secure-store`, `expo-auth-session`, `expo-notifications`, `expo-local-authentication`, `expo-camera`,
React Hook Form, Zod, Jest, Testing Library y Maestro. Para pruebas se usa `flutter_test` (sin paquete extra).

## 3. Arquitectura

```
App (Android / iOS, Flutter)                 Servidor (el mismo de la web)
┌──────────────────────────────────┐        ┌─────────────────────────────────┐
│ Pestañas por rol (go_router)     │  HTTPS │ ALB → EC2 → Laravel /api/v1     │
│ Riverpod (AuthController, etc.)  │───────▶│ Sanctum (token Bearer 60 min)   │
│ Dio: Bearer, 401, 429, 503, 5xx  │        │ Roles y policies                │
│ flutter_secure_storage: token    │        │ (Notificaciones: pendiente)     │
└──────────────────────────────────┘        └─────────────────────────────────┘
```

Organización de `mobile/lib/`:

```
lib/core/       cliente HTTP (api/), sesión (auth/), tema, rutas, configuración y pestañas por rol
lib/features/   auth (login), recepcion, almacen, panel, cuenta, errores, shell (barra inferior)
test/           pruebas; support/fakes.dart reemplaza el adaptador HTTP de Dio y el almacén de sesión
```

Cada funcionalidad expone un «módulo» (`*_module.dart`) con su pestaña (`AppTab`). `lib/core/modules.dart` decide
qué pestañas ve cada rol y el perfil «Cuenta» va siempre al final.

- **Misma API, mismo formato.** La app lee `{ success, data, meta }` y el error `{ success: false, error: { code,
  message, details } }`, igual que la web. Los campos `retry_after` y `attempts_left` del login se usan en la pantalla.
- **Interceptores (Dio).** Añaden `Authorization: Bearer` y `Accept-Language: es`. Un 401 cierra la sesión y lleva a
  «Sesión vencida»; un 429 lee `Retry-After`; un 503 lleva a «Servicio no disponible»; un 403 o un 5xx en una lectura
  dispara el evento global de error; sin red lleva a «Sin conexión».
- **Token por dispositivo.** El login envía `device_name: app-movil` (`lib/core/config.dart`). Así el token de la app
  se puede cerrar sin afectar a otros equipos. Pendiente: nombrar cada teléfono (p. ej. «iPhone de Ana»).
- **Renovación.** `AuthController` llama a `POST /auth/refresh` 5 minutos antes de que venza el token, con un mínimo
  de 30 segundos entre intentos. Al arrancar, si hay sesión guardada, la app pide `GET /auth/me` para validarla.
- **Sin paquete compartido.** El diseño original preveía `packages/shared/` para compartir tipos con la web. No se
  hizo: la app está en Dart y no puede importar los tipos TypeScript de `web/src/types.ts`. Los modelos se escriben a
  mano en Dart (`lib/core/auth/models.dart`) a partir de esos tipos. `packages/` no existe en el monorepo.

## 4. Cambios en la API

| Cambio | Para qué | Estado |
| --- | --- | --- |
| `POST /devices` y `DELETE /devices/{token}` (tabla `push_tokens`) | Registrar el token de notificaciones del teléfono | Pendiente / no incluido todavía |
| Notificaciones en cola (llegadas del día, habitación lista, insumo bajo el mínimo) | Avisos al teléfono del personal | Pendiente / no incluido todavía |
| Google OAuth con redirección a `legrandhotel://auth/callback` | Login con Google en la app | Pendiente / no incluido todavía. La app solo usa correo y contraseña |
| Cabecera `X-App-Version` y respuesta 426 si la versión es obsoleta | Obligar a actualizar si cambia la API | Pendiente / no incluido todavía. La app no envía la cabecera |

No se han hecho cambios en la API para la app. CORS no aplica a apps nativas (la app no envía `Origin`); los límites de
peticiones y los roles son los mismos de la web.

## 5. Pantallas

### Pantallas implementadas

| Pantalla | Rol | Endpoints reales |
| --- | --- | --- |
| Login (solo personal; sin registro) | Todos | `POST /auth/login` (aviso de intentos restantes y cuenta regresiva con `LOGIN_LOCKED`), `GET /auth/me` |
| **Recepción**, pestaña Hoy: llegadas y salidas con check-in / check-out | Admin, Recepcionista | `GET /reservations?check_in=hoy`, `GET /stays?active=1`, `POST /reservations/{id}/check-in`, `POST /stays/{id}/check-out` |
| Recepción, pestaña Reservar: huésped → fechas → habitación disponible | Admin, Recepcionista | `GET /clients?search=`, `POST /clients`, `GET /rooms/available`, `POST /reservations` |
| Recepción, pestaña Habitaciones por piso con cambio de estado | Admin, Recepcionista | `GET /rooms`, `PATCH /rooms/{id}/status` |
| Recepción, pestaña Cochera: entrada y salida de placa | Admin, Recepcionista | `GET /parking-spots`, `GET /parking-assignments?active=1`, `POST /parking-assignments`, `PUT /parking-assignments/{id}` (salida con `left_at`) |
| **Almacén**: Inventario con búsqueda, entrada/salida y filtro «Solo bajo el mínimo» | Admin, Almacenero | `GET /inventory-items`, `POST /inventory-items/{id}/movements` |
| **Panel** resumido | Admin, Programador | `GET /dashboard`; `GET /reports/occupancy` solo para el Administrador |
| **Cuenta**: nombre, correo, roles y cerrar sesión | Todos | `POST /auth/logout` |
| Pantallas de error: sin conexión, sesión vencida, sin permiso (403), demasiadas peticiones (429), error del servidor (500, con código de incidencia si lo hay), servicio no disponible (503) | Todos | Interceptores de Dio |

### Pestañas por rol (`lib/core/modules.dart`, según `api/routes/api.php`)

| Rol | Pestañas |
| --- | --- |
| Administrador (`admin`) | Recepción, Almacén, Panel, Cuenta |
| Recepcionista (`receptionist`) | Recepción, Cuenta |
| Almacenero (`storekeeper`) | Almacén, Cuenta |
| Programador (`developer`) | Panel, Cuenta |

### Huecos conocidos (de la revisión de M2 y M3)

- Hoy y Cochera traen solo la primera página de 50 filas, sin paginar.
- En Recepción no se pueden cancelar ni editar reservas.
- No hay estado de mantenimiento para espacios de cochera.
- Las fechas se escriben como dd/mm/aaaa sin el paquete `intl`.
- El panel no tiene selector de fechas.
- No hay pruebas de widgets para las pantallas de recepción, almacén ni panel (solo para el login).

### Pantallas del diseño original no construidas

- Notificaciones y avisos al teléfono (pendiente / no incluido todavía).
- Login con Google en la app (pendiente / no incluido todavía).

Cuentas de demostración del personal: `admin@`, `recepcion@`, `almacen@` y `dev@legrandhotel.test`. La contraseña es la
de `DEMO_PASSWORD` del `.env` de la API; no está en este repositorio y no se escribe aquí.

### Diseño visual

Los mismos tokens de la web (tinta `#131416`, acento `#1b6c80`, tipografía IBM Plex Sans), definidos en
`mobile/lib/core/theme.dart`. Tema claro y oscuro. Botones de al menos 44 × 44 pt. Los bocetos están en
`docs/movil/pantallas.png`.

## 6. Seguridad

- El token vive en el almacenamiento seguro del sistema (Keychain en iOS, Keystore en Android) con
  `flutter_secure_storage`, nunca en texto plano. La app no guarda la contraseña.
- Solo HTTPS en las compilaciones de release. El tráfico sin cifrar (`http://`) solo está permitido en depuración, en
  `android/app/src/debug/AndroidManifest.xml`; para iOS, una excepción de App Transport Security solo para depuración
  (pendiente de hacer en `ios/Runner/Info.plist`, ver sección 7).
- Pendiente / no incluido todavía: bloqueo con huella o rostro al abrir la app; certificate pinning.
- Ofuscación: la compilación de release no usa `--obfuscate --split-debug-info` todavía (pendiente).
- La app no incluye secretos: todo secreto queda en el servidor. La dirección de la API se fija al compilar.

## 7. Compilación, pruebas y publicación

### Dirección de la API

Se fija con `--dart-define=API_URL=...` (`lib/core/config.dart`). Sin el parámetro usa Render
(`https://legrandhotel-api.onrender.com/api/v1`). La dirección incluye `/api/v1` y no lleva barra final.

| Entorno | Comando |
| --- | --- |
| Render (por defecto) | `flutter run` |
| Local desde el emulador Android | `flutter run --dart-define=API_URL=http://10.0.2.2:8000/api/v1` |
| Local desde un teléfono físico (misma red Wi-Fi) | `flutter run --dart-define=API_URL=http://<IP-de-tu-PC>:8000/api/v1` |
| AWS (cuando exista) | `flutter run --dart-define=API_URL=https://<api_domain>/api/v1` |

Para un teléfono físico, la API debe arrancar con `php artisan serve --host=0.0.0.0`. Render en plan gratuito se
duerme: la primera petición puede tardar hasta un minuto y la app muestra «sin conexión» o «servicio no disponible»
con opción de reintentar.

### Comandos reales

```bash
cd mobile
flutter pub get
flutter analyze                       # sin errores
flutter test                          # 38 pruebas
flutter build apk --debug --dart-define=API_URL=http://10.0.2.2:8000/api/v1
# salida: build/app/outputs/flutter-apk/app-debug.apk   (163 MB, normal en depuración)
flutter build apk --release       --dart-define=API_URL=https://<api>/api/v1
flutter build appbundle --release --dart-define=API_URL=https://<api>/api/v1
# salidas: build/app/outputs/flutter-apk/app-release.apk
#          build/app/outputs/bundle/release/app-release.aab
flutter build ipa --release --dart-define=API_URL=https://<api>/api/v1    # solo en un Mac con Xcode
```

Las pruebas no usan red ni el almacenamiento seguro: reemplazan el adaptador HTTP de Dio y el almacén de sesión.
Cubren el formato de respuesta y de error, los interceptores, el `AuthController` (login del personal, rechazo de
clientes, renovación, arranque con sesión guardada, cierre de sesión), las pestañas por rol y la pantalla de login.

### Firma y publicación

- El release de Android se firma con la **clave de depuración** (valor por defecto de Flutter). Sirve para probar,
  pero **no para Google Play**. Antes de publicar: crear un keystore propio
  (`keytool -genkey -v -keystore upload-keystore.jks -keyalg RSA -keysize 2048 -validity 10000 -alias upload`),
  guardarlo fuera del repositorio, referenciarlo desde `android/key.properties` (ignorado por git) y cambiar el
  `signingConfig` del buildType `release` en `android/app/build.gradle.kts`.
- `applicationId` y `namespace` actuales: `pe.legrandhotel.legrandhotel_movil`. Cámbialo antes de la primera publicación
  si se quiere otro.
- Requisitos de las tiendas: cuenta de Google Play Console (pago único de USD 25) y Apple Developer Program (USD 99 al
  año). Para distribución de prueba basta con la cuenta gratuita de Apple para instalar en un equipo propio.
- Pendiente / no incluido todavía: flujo de CI para `mobile/` (en `.github/workflows` solo hay `ci.yml` y `deploy.yml`,
  sin Flutter); distribución de prueba en Google Play o TestFlight; actualizaciones en caliente; errores en producción
  (Sentry); pruebas E2E.

### iOS: qué falta

La carpeta `ios/` existe (la generó Flutter), pero **nunca se ha compilado**: hace falta un Mac con Xcode.

1. Mac con Xcode estable y CocoaPods; `flutter doctor` sin errores en «Xcode».
2. `cd mobile && flutter pub get && cd ios && pod install`.
3. Abrir `ios/Runner.xcworkspace` en Xcode, elegir el equipo de firma en *Signing & Capabilities* y cambiar el
   *Bundle Identifier* (`pe.legrandhotel.legrandhotelMovil` por defecto) si se quiere otro.
4. Probar en el simulador con `flutter run --dart-define=API_URL=http://localhost:8000/api/v1`. Para `http://` hay que
   permitirlo en `ios/Runner/Info.plist` solo para depuración; con `https://` no hace falta.
5. Publicar con `flutter build ipa --release` y subir el `.ipa` con Xcode (Organizer) o Transporter.

## 8. Estado por entregas

| Entrega | Alcance | Estado |
| --- | --- | --- |
| M1 | Núcleo: proyecto, cliente HTTP, login del personal, token seguro, renovación, cierre de sesión, tema, navegación por rol, pantallas de error | Hecho |
| M2 | Recepción: Hoy (check-in/check-out), Reservar, Habitaciones, Cochera | Hecho (con huecos de la sección 5) |
| M3 | Almacén (Inventario) y Panel resumido | Hecho |
| M4 | `flutter analyze`, 38 pruebas, APK de depuración, README | Hecho. Sin probar en emulador ni en teléfono |
| Pendiente | Notificaciones, login con Google en la app, `X-App-Version`, huella o rostro, certificate pinning, release firmado, CI para `mobile/`, iOS compilado, pruebas E2E, publicación en tiendas | Pendiente / no incluido todavía |
