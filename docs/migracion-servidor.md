# Estrategia de migración de servidor sin pérdida de servicio (EXTRA del 100%)

Objetivo: mover LeGrandHotel a otra región, instancia o proveedor sin perder reservas y con una
ventana sin escrituras de 1–2 minutos como máximo.

| Paso | Qué se hace | Por qué evita perder servicio |
| --- | --- | --- |
| 1. Preparar | Levantar el entorno nuevo con la misma imagen Docker de ECR (`terraform apply` con otra `region` o `environment`) | La app ya está empaquetada: no hay instalación manual |
| 2. Replicar datos | Réplica de lectura de RDS en el destino (o volcado + replicación continua con AWS DMS) | El servidor nuevo tiene los datos al día |
| 3. Probar | `tests/k6/smoke.js` y una carga corta (`PROFILE=carga-25`) contra el entorno nuevo | Se detectan fallas antes de mover usuarios |
| 4. Bajar el TTL del DNS | Route 53 con TTL de 60 s un día antes | El cambio se propaga en minutos |
| 5. Cambio gradual | Registros ponderados 10% → 50% → 100% hacia el entorno nuevo (blue/green), vigilando las alarmas 5xx y latencia | Si hay errores se vuelve atrás sin afectar a todos |
| 6. Corte de escritura | `php artisan down --retry=60` en el viejo (la API responde 503 con motivo), promover la réplica a principal, `php artisan up` en el nuevo | Ventana mínima sin escrituras y sin pérdida de datos |
| 7. Retirar el viejo | Mantenerlo 48 h como respaldo (solo lectura) y luego apagarlo | Plan de reversa disponible |

## Reversa

Si en el paso 5 o 6 las alarmas superan el umbral (5xx > 10/min o p95 > 800 ms durante 5 min):
volver el peso del DNS al 100% del entorno viejo; mientras no se promueva la réplica, el viejo sigue
siendo la fuente de verdad, así que no hay datos que reconciliar.

## Checklist del día del corte

- [ ] Respaldo manual a S3 (`infra/scripts/backup-mysql-to-s3.sh`) y snapshot de RDS
- [ ] Lag de la réplica en 0 s
- [ ] Smoke test verde en el nuevo entorno
- [ ] Equipo avisado de la ventana
- [ ] Registrar en `docs/incidentes.md` cualquier error durante el corte
