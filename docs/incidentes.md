# Registro de incidentes y caídas

Toda caída, aunque sea en pruebas o en local, se anota **el mismo día** con esta plantilla.
Lo pide el profesor en cada entrega.

| Fecha | Entorno | Qué falló | Motivo | Solución | Tiempo caído |
| --- | --- | --- | --- | --- | --- |
| 2026-10-26 | Local (desarrollo) | El login devolvía 500 `INTERNAL_ERROR` con código de incidente `XG1R7UASWT` | `php artisan serve` lanza procesos PHP hijos sin la extensión `pdo_sqlite`, cargada solo con `-d` en el proceso padre ("could not find driver") | Se arranca el servidor local con `php -d extension=pdo_sqlite -S localhost:8000 -t api/public api/public/index.php` (`.claude/launch.json`). El error salió como JSON sin trazas, como exige el plan | ~2 min |
| 2026-10-26 | Local (desarrollo) | El frontend mostró la pantalla 503 "No se pudo contactar con el servidor" | Durante el cambio anterior el servidor PHP apuntaba a un `server.php` que buscaba `index.php` en la carpeta equivocada | Se usa `api/public/index.php` como router del servidor. La pantalla 503 reintentó sola cada 30 s | ~1 min |
| 2026-10-27 | Local (pruebas k6) | Primera serie de k6: 100% de peticiones fallidas | El servidor PHP escuchaba solo en IPv6 (`::1`) y k6 resolvía `localhost` a IPv4 (127.0.0.1) | `BASE_URL=http://[::1]:8000/api/v1`; se borraron los resultados inválidos y se repitieron las 5 corridas | ~5 min |
| 2026-10-27 | Local (desarrollo, MySQL) | El primer inicio con Google devolvió 500 `INTERNAL_ERROR` (incidente `JJA05WR4CG`) y `/health` marcó la base «down» | Al editar `api/.env` para agregar `GOOGLE_CLIENT_ID` y `GOOGLE_CLIENT_SECRET` se borró un carácter de `DB_PASSWORD`: MySQL respondió «Access denied for user 'legrandhotel'» | Se restauró `DB_PASSWORD` igual a `MYSQL_PASSWORD` de `docker-compose.yml`; `/health` volvió a «ok». El código de incidente permitió hallar la causa en `storage/logs` en segundos | ~1 min |
| 2026-10-27 | Local (desarrollo) | Después de entrar con Google el navegador mostró `ERR_INVALID_REDIRECT` | `FRONTEND_URL` lista dos dominios separados por coma (para CORS) y el callback de Google y la verificación de correo lo usaban completo como dirección de regreso | Nuevo `App\Support\Frontend::url()` que redirige al primer dominio; prueba que lo cubre en `ClientPortalTest` | ~3 min |
| 2026-10-27 | Local (pruebas k6 del equipo) | `k6 run` se detenía en `setup()` con «La API no está sana antes de la prueba: 503» | El contenedor `nginx` de `docker compose` ocupaba el puerto 8000; k6 hablaba con ese Nginx (sin PHP detrás) y no con la API | `docker compose down` y encender solo MySQL (`docker compose up -d mysql`); el tutorial de k6 lo explica en el paso 2 | ~10 min |
| 2026-10-27 | Local (navegador Brave) | Al volver de Google la página quedaba en blanco con `#token=…` en la dirección | La aplicación no llegó a arrancar en esa pestaña de Brave (la API nunca recibió `/auth/me`), probablemente por sus escudos (Shields); en Chrome el mismo flujo funcionó | Usar Chrome o desactivar Shields para `localhost`; se comprobó el flujo completo con una cuenta de prueba | ~15 min |
| 2026-10-27 | Local (Vista del programador) | La pestaña «Errores» mostró la pantalla 500 con código `WEB-MVRL1WBX` | Laravel guarda algunas excepciones en el log como objeto (`class`, `message`, `file`) y la pantalla intentaba mostrarlas como texto (error de React) | `RequestLogReader` devuelve siempre la clase como texto; prueba nueva en `DeveloperViewTest` | ~5 min |

## Plantilla

```
| AAAA-MM-DD | Local / Pruebas / Producción | Síntoma visto por el usuario | Causa raíz (con evidencia: log, gráfico) | Qué se cambió y dónde | hh:mm |
```

Evidencias útiles: consulta guardada "LeGrandHotel/Errores 5xx" en CloudWatch Logs Insights,
alarmas `legrandhotel-prod-5xx`, `-latencia-p95`, `-instancias-caidas`, y el `incident_id`
que devuelve la API en los 500/503 (está en el log JSON con el mismo valor).
