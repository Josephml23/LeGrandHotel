# Diseño de pantallas de LeGrandHotel

Todas las pantallas de la web con el estilo "framed-sheet" (tokens en `web/src/styles.css`), capturadas a 1440×900.
Hay dos tipos de cuenta y cada una ve solo lo suyo:

- **Personal del hotel** (Administrador, Recepcionista, Almacenero, Programador): entra con correo y contraseña.
  Sus cuentas las crean el Administrador y el Programador (el Programador no puede crear Programadores).
- **Cliente**: entra solo con Google. La primera vez completa su DNI y teléfono; después reserva por tipo de habitación,
  ve lo que incluye cada tipo, cuántas quedan libres y el total, y puede cancelar sus reservas antes del día de llegada.

Las capturas se tomaron con la API y la web corriendo en local (`.claude/launch.json`) y las cuentas de `DemoSeeder`
(solo para uso local).

## Acceso

| # | Pantalla | Ruta | Quién |
| --- | --- | --- | --- |
| 01 | ![](pantallas/01-login.png) Iniciar sesión: personal con correo y contraseña; huéspedes con "Continuar con Google" | `/login` | Público |
| 02 | ![](pantallas/02-cliente-completar-registro.png) Completar registro: DNI y teléfono (nombre y correo vienen de Google) | `/completar-registro` | Cliente nuevo |

## Portal del cliente

| # | Pantalla | Ruta |
| --- | --- | --- |
| 03 | ![](pantallas/03-cliente-reservar.png) Reservar: fechas, personas y tarjetas por tipo con servicios, libres y total | `/reservar` |
| 04 | ![](pantallas/04-cliente-confirmar-reserva.png) Confirmación de la reserva (el hotel asigna la habitación) | `/reservar` |
| 05 | ![](pantallas/05-cliente-mis-reservas.png) Mis reservas, con opción de cancelar | `/mis-reservas` |

## Panel del personal

| # | Pantalla | Ruta | Roles |
| --- | --- | --- | --- |
| 06 | ![](pantallas/06-panel.png) Panel del día | `/panel` | Admin, Recepción, Almacén |
| 07 | ![](pantallas/07-reservas.png) Reservas | `/reservas` | Admin, Recepción |
| 08 | ![](pantallas/08-estadias.png) Estadías (check-out) | `/estadias` | Admin, Recepción |
| 09 | ![](pantallas/09-habitaciones.png) Habitaciones | `/habitaciones` | Admin, Recepción |
| 10 | ![](pantallas/10-tipos-habitacion.png) Tipos de habitación, con lo que incluye cada uno | `/tipos-habitacion` | Admin (edita), Recepción |
| 11 | ![](pantallas/11-clientes.png) Clientes (indica si tienen cuenta web) | `/clientes` | Admin, Recepción |
| 12 | ![](pantallas/12-cochera.png) Cochera | `/cochera` | Admin, Recepción |
| 13 | ![](pantallas/13-inventario.png) Inventario | `/inventario` | Admin, Almacén |
| 14 | ![](pantallas/14-personal.png) Personal | `/personal` | Admin |
| 15 | ![](pantallas/15-registrar-personal-admin.png) Registrar personal (Admin: los 4 roles) | `/registro` | Admin |
| 16 | ![](pantallas/16-usuarios.png) Usuarios y roles | `/usuarios` | Admin |
| 17 | ![](pantallas/17-reportes.png) Reportes | `/reportes` | Admin |
| 18 | ![](pantallas/18-auditoria.png) Auditoría | `/auditoria` | Admin |
| 19 | ![](pantallas/19-programador.png) Vista del programador | `/programador` | Programador, Admin |
| 20 | ![](pantallas/20-registrar-personal-programador.png) Registrar personal (Programador: Recepción, Almacén, Administración) | `/registro` | Programador |

## Pantallas de error y estado

| # | Pantalla | Cuándo aparece |
| --- | --- | --- |
| 21 | ![](pantallas/21-error-401-sesion-expirada.png) 401 Sesión expirada | La API responde 401 con el token vencido |
| 22 | ![](pantallas/22-error-403.png) 403 Sin acceso | El rol no tiene permiso, aunque la ruta se escriba a mano |
| 23 | ![](pantallas/23-error-404.png) 404 Esta habitación no existe | Ruta inexistente |
| 24 | ![](pantallas/24-error-429.png) 429 Demasiadas peticiones | Se superó el límite; cuenta regresiva con Retry-After |
| 25 | ![](pantallas/25-error-500.png) 500 Error del servidor | Error inesperado; muestra el código de incidente |
| 26 | ![](pantallas/26-error-503.png) 503 Servicio no disponible | La base o la API no responden; reintenta cada 30 s y vuelve sola |
| 27 | ![](pantallas/27-en-construccion.png) En construcción | Módulo pendiente (Facturación) |
| 28 | ![](pantallas/28-sin-conexion.png) Sin conexión | El equipo perdió internet; bloquea la pantalla sin perder datos |
