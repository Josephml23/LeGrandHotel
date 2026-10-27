# LeGrandHotel Móvil — diseño de la aplicación para Android e iOS

Estado: **diseño** (no hay código de la app todavía). Se presenta como EXTRA y se construye en las entregas siguientes.

## 1. Objetivo

Llevar al teléfono del **personal del hotel** las tareas que se hacen lejos de un escritorio, usando **la misma API**
(`/api/v1`) que la página web. Igual que la web, es una herramienta **interna**: no tiene registro público y ningún
huésped ni persona externa puede entrar; las cuentas las crea el Administrador. La app no reemplaza a la web: cubre
lo que conviene hacer en movimiento.

| Usuario | Para qué usa la app |
| --- | --- |
| Recepcionista | Ver las llegadas y salidas del día, hacer check-in y check-out desde el lobby, registrar la reserva de un huésped que llega o llama, cambiar el estado de una habitación, registrar la placa en la cochera |
| Almacenero | Registrar entradas y salidas de inventario en el almacén y ver los insumos bajo el mínimo |
| Administrador | Ver el panel (ocupación, ingresos del mes, alertas). La gestión completa (personal, usuarios, reportes) sigue en la web |
| Programador | Sin app: usa la vista web `/programador` |

## 2. Tecnología elegida: React Native con Expo (TypeScript)

| Opción | Ventajas | Desventajas | Decisión |
| --- | --- | --- | --- |
| **React Native + Expo** | Un solo código para Android e iOS; usa React y TypeScript como la web, así el equipo reutiliza lo que ya sabe; comparte tipos y cliente de la API; compila en la nube (EAS Build) sin necesitar una Mac para iOS | Algunas funciones nativas muy específicas requieren módulos propios | **Elegida** |
| Flutter | Muy buen rendimiento y diseño consistente | Otro lenguaje (Dart): no se reutiliza código ni conocimiento de la web | Descartada |
| Nativo (Kotlin + Swift) | Máximo acceso al sistema | Dos aplicaciones separadas, el doble de trabajo para un equipo de 4 | Descartada |
| PWA (la web instalable) | Cero código nuevo | Notificaciones y almacenamiento seguro limitados en iOS; no está en las tiendas | Complemento, no reemplazo |

Librerías previstas (las mismas ideas de la web):

| Necesidad | Librería | Equivalente en la web |
| --- | --- | --- |
| Navegación por pantallas | Expo Router (rutas por archivos) | React Router |
| Llamadas a la API y caché | TanStack Query + Axios | Igual |
| Guardar el token de forma segura | `expo-secure-store` (Keychain en iOS, Keystore en Android) | `sessionStorage` |
| Login con Google (solo cuentas del personal ya registradas) | `expo-auth-session` + enlace profundo `legrandhotel://auth/callback` | Socialite con redirección |
| Notificaciones | `expo-notifications` (FCM en Android, APNs en iOS) | — |
| Desbloqueo con huella o rostro | `expo-local-authentication` | — |
| Lector de placas / QR (fase 2) | `expo-camera` | — |
| Formularios y validación | React Hook Form + Zod | Formularios propios |
| Pruebas | Jest + React Native Testing Library; Maestro para flujos completos | Vitest + Testing Library; Playwright |

## 3. Arquitectura

```
App (Android / iOS)                         Servidor (el mismo de la web)
┌──────────────────────────────┐            ┌─────────────────────────────┐
│ Pantallas por rol (Expo Router)│  HTTPS    │ ALB → EC2 → Laravel /api/v1  │
│ TanStack Query + Axios ───────┼──────────▶│ Sanctum (token Bearer 60 min)│
│ SecureStore: token            │            │ Roles y policies             │
│ Notificaciones (FCM / APNs) ◀─┼──────────── │ Expo Push API (cola Redis)   │
└──────────────────────────────┘            └─────────────────────────────┘
```

- **Misma API, mismo formato.** La app recibe `{ success, data, meta }` o `{ success: false, error: { code, message } }`,
  igual que la web; el interceptor de Axios se reutiliza casi sin cambios (401 → "Sesión expirada", 429 → espera, 503 → reintento).
- **Token por dispositivo.** El login ya acepta `device_name`; la app envía p. ej. `"iPhone de Ana"`. Así el usuario puede
  cerrar la sesión de un teléfono sin afectar a los demás.
- **Renovación.** La app llama a `POST /auth/refresh` 5 minutos antes de que venza el token, como la web.
- **Paquete compartido.** Los tipos (`Reservation`, `Room`, …) y el cliente de la API pasan a `packages/shared/` dentro del
  monorepo para que web y móvil no se desincronicen.

## 4. Cambios necesarios en la API (pequeños)

| Cambio | Para qué | Entrega |
| --- | --- | --- |
| `POST /devices` y `DELETE /devices/{token}` (tabla `push_tokens`) | Registrar el token de notificaciones del teléfono | 80% |
| Notificaciones en cola: llegadas del día, habitación lista tras la limpieza, insumo bajo el mínimo | Avisos al teléfono del personal | 80% |
| Google OAuth con redirección a `legrandhotel://auth/callback` además de la web | Login con Google en la app | 80% |
| Cabecera `X-App-Version` y respuesta 426 si la versión es obsoleta | Obligar a actualizar si cambia la API | 100% |
| Nada más: CORS no aplica a apps nativas; los rate limits y roles son los mismos | — | — |

## 5. Pantallas

| Pantalla | Rol | Datos (endpoint) |
| --- | --- | --- |
| Login (solo personal; sin registro) | Todos | `/auth/login` |
| Nueva reserva: huésped → fechas → habitación disponible | Recepción | `/clients`, `/rooms/available`, `POST /reservations` |
| Hoy en recepción: llegadas y salidas con check-in / check-out | Recepción | `/reservations?check_in=hoy`, `/reservations/{id}/check-in`, `/stays/{id}/check-out` |
| Habitaciones por piso (el "rack") con cambio de estado | Recepción | `/rooms`, `PATCH /rooms/{id}/status` |
| Cochera: registrar placa y salida | Recepción | `/parking-assignments` |
| Inventario: buscar insumo, entrada/salida, alertas | Almacén | `/inventory-items`, `/inventory-items/{id}/movements` |
| Panel resumido | Admin | `/dashboard`, `/reports/occupancy` |
| Pantallas de error: sin conexión, sesión expirada, 403, 429, 500, 503 | Todos | Interceptor |

Navegación: barra inferior con 3–4 pestañas según el rol (recepción ve Hoy, Reservar, Habitaciones, Cochera;
almacén ve Insumos, Alertas, Perfil). El registro de cuentas del personal se hace solo en la web, en el panel del Administrador.

Diseño visual: los mismos tokens de la web (tinta `#131416`, acento `#1b6c80`, IBM Plex Sans), botones de al menos 44 × 44 pt,
textos que respetan el tamaño de letra del sistema y modo oscuro. Bocetos en `docs/movil/pantallas.png`.

## 6. Seguridad

- El token vive en el almacenamiento seguro del sistema (Keychain / Keystore), nunca en texto plano.
- Bloqueo opcional con huella o rostro al abrir la app (personal del hotel).
- Solo HTTPS; en producción se evalúa fijar el certificado (certificate pinning).
- El código de la app se ofusca en la compilación de producción (Hermes + minificación) y no incluye secretos:
  todo secreto queda en el servidor.

## 7. Compilación, pruebas y publicación

| Paso | Herramienta |
| --- | --- |
| Desarrollo en el teléfono propio | Expo Go / development build |
| Compilar Android (AAB) e iOS (IPA) en la nube | EAS Build (no requiere Mac) |
| Distribución de prueba | Google Play — prueba interna · Apple TestFlight |
| Actualizaciones sin pasar por la tienda (solo JavaScript) | EAS Update |
| CI | GitHub Actions: lint, tipos, Jest y build de vista previa en cada PR |
| Errores en producción | Sentry |

Requisitos de las tiendas: cuenta de Google Play Console (pago único USD 25) y Apple Developer Program (USD 99 al año).
Para el curso basta la distribución de prueba.

## 8. Plan por entregas

| Entrega | Alcance de la app |
| --- | --- |
| 25% | Diseño (este documento), pantallas y arquitectura |
| 80% | Proyecto Expo en `mobile/`, login, recepción ("Hoy" con check-in/out, nueva reserva, habitaciones), notificaciones; build de prueba Android |
| 100% | Inventario, cochera, panel admin, build iOS en TestFlight, pruebas E2E con Maestro, publicación de prueba en ambas tiendas |
