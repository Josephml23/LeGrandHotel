# Registro de incidentes y caídas

Toda caída, aunque sea en pruebas o en local, se anota **el mismo día** con esta plantilla.
Lo pide el profesor en cada entrega.

| Fecha | Entorno | Qué falló | Motivo | Solución | Tiempo caído |
| --- | --- | --- | --- | --- | --- |
| 2026-10-26 | Local (desarrollo) | El login devolvía 500 `INTERNAL_ERROR` con código de incidente `XG1R7UASWT` | `php artisan serve` lanza procesos PHP hijos sin la extensión `pdo_sqlite`, cargada solo con `-d` en el proceso padre ("could not find driver") | Se arranca el servidor local con `php -d extension=pdo_sqlite -S localhost:8000 -t api/public api/public/index.php` (`.claude/launch.json`). El error salió como JSON sin trazas, como exige el plan | ~2 min |
| 2026-10-26 | Local (desarrollo) | El frontend mostró la pantalla 503 "No se pudo contactar con el servidor" | Durante el cambio anterior el servidor PHP apuntaba a un `server.php` que buscaba `index.php` en la carpeta equivocada | Se usa `api/public/index.php` como router del servidor. La pantalla 503 reintentó sola cada 30 s | ~1 min |

## Plantilla

```
| AAAA-MM-DD | Local / Pruebas / Producción | Síntoma visto por el usuario | Causa raíz (con evidencia: log, gráfico) | Qué se cambió y dónde | hh:mm |
```

Evidencias útiles: consulta guardada "LeGrandHotel/Errores 5xx" en CloudWatch Logs Insights,
alarmas `legrandhotel-prod-5xx`, `-latencia-p95`, `-instancias-caidas`, y el `incident_id`
que devuelve la API en los 500/503 (está en el log JSON con el mismo valor).
