# LeGrandHotel — app móvil del personal (Flutter)

App para Android e iOS del **personal** del hotel (Administrador, Recepcionista, Almacenero y Programador). Usa la misma
API que la web (`/api/v1`). Los clientes entran solo con Google en la web: esta app rechaza sus cuentas.

Pantallas: login (con aviso de intentos y cuenta regresiva), **Recepción** (Hoy con check-in/check-out, Reservar,
Habitaciones por piso, Cochera), **Almacén** (Inventario con movimientos y alertas), **Panel** (resumen del
administrador) y **Cuenta**. Pantallas de error: sin conexión, sesión vencida, sin permiso, demasiadas peticiones,
error del servidor y servicio no disponible.

## Qué ve cada rol

Las pestañas salen de `lib/core/modules.dart` y coinciden con los permisos de `api/routes/api.php`:

| Rol | Pestañas |
|-----|----------|
| Administrador (`admin`) | Recepción, Almacén, Panel, Cuenta |
| Recepcionista (`receptionist`) | Recepción, Cuenta |
| Almacenero (`storekeeper`) | Almacén, Cuenta |
| Programador (`developer`) | Panel, Cuenta (sin el resumen de ocupación, que es solo del Administrador) |

Cuentas de demostración del personal (se crean con los seeders de la API): `admin@legrandhotel.test`,
`recepcion@legrandhotel.test`, `almacen@legrandhotel.test` y `dev@legrandhotel.test`. La contraseña es la de
`DEMO_PASSWORD` del `.env` de la API; **no está en este repositorio** y no se escribe aquí.

## Requisitos

- Flutter 3.47 o superior (Dart 3.13). Verifica con `flutter doctor`.
- Android: Android SDK 36 con las licencias aceptadas (`flutter doctor --android-licenses`) y un emulador (AVD) o un
  teléfono con depuración USB.
- Para correr contra la API local: la API de `api/` levantada en el puerto 8000 (`php artisan serve` o Docker).

```bash
cd mobile
flutter pub get
```

## Dirección de la API

Se fija al compilar con `--dart-define=API_URL=...` (`lib/core/config.dart`). Sin ese parámetro usa Render. La dirección
**incluye** `/api/v1` y no lleva barra final.

| Entorno | Comando |
|---------|---------|
| Render (por defecto) | `flutter run` |
| Local desde el emulador Android | `flutter run --dart-define=API_URL=http://10.0.2.2:8000/api/v1` |
| Local desde un teléfono físico (misma red Wi-Fi) | `flutter run --dart-define=API_URL=http://<IP-de-tu-PC>:8000/api/v1` |
| AWS (cuando exista) | `flutter run --dart-define=API_URL=https://<api_domain>/api/v1` |

Notas:

- `10.0.2.2` es el `localhost` de tu PC visto desde el emulador de Android. Para que la API acepte conexiones del
  teléfono físico, arráncala con `php artisan serve --host=0.0.0.0`.
- El tráfico sin cifrar (`http://`) solo está permitido en las compilaciones de **depuración**
  (`android/app/src/debug/AndroidManifest.xml`). Las de release exigen `https://` (Render y AWS ya lo usan).
- Render en plan gratuito se duerme: la primera petición puede tardar hasta un minuto. Mientras tanto la app muestra
  «sin conexión» o «servicio no disponible» y se puede reintentar.
- No ejecutes pruebas de carga ni crees datos de prueba contra Render ni AWS desde la app.

### Correr en el emulador (paso a paso)

```bash
flutter emulators                     # lista los AVD
flutter emulators --launch <id>       # inicia uno
flutter devices                       # confirma que aparece
flutter run --dart-define=API_URL=http://10.0.2.2:8000/api/v1
```

## Pruebas y análisis

```bash
flutter analyze
flutter test
```

Las pruebas no usan red ni el almacenamiento seguro: reemplazan el adaptador HTTP de Dio y el `SessionStore`
(`test/support/fakes.dart`). Cubren el formato `{success,data,meta}` y el de error (`code`, `message`, `details`
con `retry_after` / `attempts_left`), los interceptores (Bearer, 401, 429 con `Retry-After`, 503, 500, 403 y sin
conexión), el `AuthController` (login del personal, rechazo de clientes, renovación, arranque con sesión guardada,
cierre de sesión), las pestañas por rol y la pantalla de login (intentos restantes y cuenta regresiva de
`LOGIN_LOCKED`).

## Compilar

### APK de depuración

```bash
flutter build apk --debug --dart-define=API_URL=http://10.0.2.2:8000/api/v1
# salida: build/app/outputs/flutter-apk/app-debug.apk  (≈ 163 MB, es normal en depuración)
```

Instalar en un teléfono o emulador conectado: `flutter install` o `adb install -r build/app/outputs/flutter-apk/app-debug.apk`.

### APK y AppBundle de release

```bash
flutter build apk --release       --dart-define=API_URL=https://<api>/api/v1
flutter build appbundle --release --dart-define=API_URL=https://<api>/api/v1
# salidas: build/app/outputs/flutter-apk/app-release.apk
#          build/app/outputs/bundle/release/app-release.aab
```

Aviso: `android/app/build.gradle.kts` firma el release con la **clave de depuración** (valor por defecto de Flutter).
Sirve para probar, pero no para publicar en Google Play. Antes de publicar: crea un keystore propio
(`keytool -genkey -v -keystore upload-keystore.jks -keyalg RSA -keysize 2048 -validity 10000 -alias upload`),
guárdalo fuera del repositorio, referénciala desde `android/key.properties` (ignorado por git) y cambia el
`signingConfig` del buildType `release`. El `applicationId` actual es `pe.legrandhotel.legrandhotel_movil`; cámbialo
antes de la primera publicación si quieres otro.

## iOS: qué falta

La carpeta `ios/` ya existe (Flutter la generó), pero **no se ha compilado nunca**: hace falta un Mac con Xcode.

1. Un Mac con Xcode (versión estable reciente) y CocoaPods; `flutter doctor` debe salir sin errores en «Xcode».
2. `cd mobile && flutter pub get && cd ios && pod install`.
3. Abrir `ios/Runner.xcworkspace` en Xcode, elegir un equipo de firma (Team) en *Signing & Capabilities* y cambiar el
   *Bundle Identifier* (`pe.legrandhotel.legrandhotelMovil` por defecto) por uno propio.
4. Probar en el simulador: `flutter run --dart-define=API_URL=http://localhost:8000/api/v1` (el simulador de iOS sí ve
   el `localhost` del Mac; para `http://` en iOS hay que permitirlo con una excepción de App Transport Security en
   `ios/Runner/Info.plist`, solo para depuración; con `https://` no hace falta).
5. En un iPhone real hace falta una cuenta de Apple Developer (gratuita para instalar en tu propio equipo; de pago,
   99 USD al año, para TestFlight y App Store).
6. Publicar: `flutter build ipa --release --dart-define=API_URL=https://<api>/api/v1` y subir el `.ipa` con Xcode
   (Organizer) o Transporter.
7. El token se guarda en el Keychain con `flutter_secure_storage`; no requiere configuración extra.

No se verificó nada de iOS en este equipo (Windows).

## Estructura

```
lib/core/       cliente HTTP (api/), sesión (auth/), tema, rutas y pestañas por rol
lib/features/   auth, recepcion, almacen, panel, cuenta, errores, shell
test/           pruebas (support/fakes.dart: adaptador HTTP y almacén en memoria)
```

La app envía `Accept-Language: es` y `device_name: app-movil` al iniciar sesión. Renueva el token con
`POST /auth/refresh` unos 5 minutos antes de que venza. Sin soporte aún: notificaciones push, login con Google y
`X-App-Version`.
