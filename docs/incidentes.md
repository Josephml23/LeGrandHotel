# Registro de incidentes y caídas

Toda caída, aunque sea en pruebas o en local, se anota **el mismo día** con esta plantilla.
Lo pide el profesor en cada entrega.

| Fecha | Entorno | Qué falló | Motivo | Solución | Tiempo caído |
| --- | --- | --- | --- | --- | --- |
| 2026-10-26 | Local (desarrollo) | El login devolvía 500 `INTERNAL_ERROR` con código de incidente `XG1R7UASWT` | `php artisan serve` lanza procesos PHP hijos sin la extensión `pdo_sqlite`, cargada solo con `-d` en el proceso padre ("could not find driver") | Se arranca el servidor local con `php -d extension=pdo_sqlite -S localhost:8000 -t api/public api/public/index.php` (`.claude/launch.json`). El error salió como JSON sin trazas, como exige el plan | ~2 min |
| 2026-10-27 | Local (pruebas k6) | Primera serie de k6: 100% de peticiones fallidas | El servidor PHP escuchaba solo en IPv6 (`::1`) y k6 resolvía `localhost` a IPv4 (127.0.0.1) | `BASE_URL=http://[::1]:8000/api/v1`; se borraron los resultados inválidos y se repitieron las 5 corridas | ~5 min |
| 2026-10-27 | Local (desarrollo, MySQL) | El primer inicio con Google devolvió 500 `INTERNAL_ERROR` (incidente `JJA05WR4CG`) y `/health` marcó la base «down» | Al editar `api/.env` para agregar `GOOGLE_CLIENT_ID` y `GOOGLE_CLIENT_SECRET` se borró un carácter de `DB_PASSWORD`: MySQL respondió «Access denied for user 'legrandhotel'» | Se restauró `DB_PASSWORD` igual a `MYSQL_PASSWORD` de `docker-compose.yml`; `/health` volvió a «ok». El código de incidente permitió hallar la causa en `storage/logs` en segundos | ~1 min |
| 2026-10-26 | Local (desarrollo) | El frontend mostró la pantalla 503 "No se pudo contactar con el servidor" | Durante el cambio anterior el servidor PHP apuntaba a un `server.php` que buscaba `index.php` en la carpeta equivocada | Se usa `api/public/index.php` como router del servidor. La pantalla 503 reintentó sola cada 30 s | ~1 min |

## Plantilla

```
| AAAA-MM-DD | Local / Pruebas / Producción | Síntoma visto por el usuario | Causa raíz (con evidencia: log, gráfico) | Qué se cambió y dónde | hh:mm |
```

Evidencias útiles: consulta guardada "LeGrandHotel/Errores 5xx" en CloudWatch Logs Insights,
alarmas `legrandhotel-prod-5xx`, `-latencia-p95`, `-instancias-caidas`, y el `incident_id`
que devuelve la API en los 500/503 (está en el log JSON con el mismo valor).
