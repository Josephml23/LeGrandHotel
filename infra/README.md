# Infraestructura de LeGrandHotel en AWS

Todo en **us-east-1**, en una VPC propia, con la base de datos y Redis en subredes privadas.
Terraform (`infra/terraform`) describe cada recurso; **no se ha aplicado todavía**: varios recursos cobran.

```
Usuario ─▶ CloudFront (HTTPS) ─▶ S3 privado (React ofuscado)
Usuario ─▶ ALB :443 ─▶ EC2 Auto Scaling 1–3 (Nginx + PHP-FPM + worker + scheduler, Docker)
                          ├─▶ RDS MySQL 8.4 (subred privada, cifrada, snapshots 7 días)
                          ├─▶ ElastiCache Redis (opcional) — caché, rate limit, colas; sin él van a MySQL
                          ├─▶ SSM Parameter Store (secretos)
                          └─▶ CloudWatch Logs /legrandhotel/api + alarmas → SNS (correo)
GitHub Actions (OIDC) ─▶ ECR (imagen) · S3 (web) · instance refresh del ASG · invalidación CloudFront
mysqldump diario ─▶ S3 de respaldos (versionado, 90 días)
```

## Costo estimado (on-demand, us-east-1, 24/7)

| Recurso | Tipo | USD/mes aprox. | Desde |
| --- | --- | --- | --- |
| EC2 | t3.small ×1 (hasta 3) | 15 (hasta 45) | 25% |
| RDS MySQL | db.t3.micro, 20 GB gp3 | 15 | 25% |
| ALB | 1 + LCU baja | 17 | 80% |
| ElastiCache | cache.t3.micro | 12 | 80% (EXTRA) |
| NAT Gateway | solo si se activa | 32 + datos | opcional |
| CloudFront + S3 | tráfico de curso | < 1 | 80% |
| CloudWatch, SSM, ECR, Backup S3 | | 1–3 | 80% |
| IPv4 públicas | ~0.005/h c/u | 4–8 | 25% |

**Total típico: 60–75 USD/mes encendido 24/7.** Apagando EC2 y RDS fuera de horario (≈ 40 h/semana)
el costo baja a ~20 USD/mes. La alerta de presupuesto de USD 10 avisa desde el primer día.
Los generadores de k6 (c5.xlarge ≈ 0.17 USD/h) se crean solo durante las pruebas y se apagan al terminar.

## Pasos (con usuario IAM de permisos mínimos, nunca la cuenta raíz)

1. Crear el certificado en ACM para `api.<dominio>` y `app.<dominio>` y validarlo por DNS.
2. `cp infra/terraform/terraform.tfvars.example infra/terraform/terraform.tfvars` y completar (con `asg_min = 0`).
3. `terraform -chdir=infra/terraform init && terraform -chdir=infra/terraform plan` → revisar el costo.
4. `terraform -chdir=infra/terraform apply`.
5. Cargar en SSM los secretos que no van en Terraform (`APP_KEY`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
   y, si se van a sembrar las cuentas de demostración, `DEMO_PASSWORD`); ver el comentario al final de `data.tf`.
6. En GitHub: environment `production` (solo rama `main`), secreto `AWS_DEPLOY_ROLE_ARN` y las variables de
   `terraform output github_variables`, más `FIRST_DEPLOY=true`.
7. Hacer push a `main`: el pipeline construye la imagen y publica la web y los archivos de despliegue.
8. Cambiar `asg_min = 1` y aplicar: la instancia arranca, migra y siembra los roles. Para las cuentas de
   demostración: `RUN_SEED=true` en SSM, instance refresh, y de vuelta a `false`.
9. Poner `FIRST_DEPLOY=false`: desde aquí cada push a `main` hace instance refresh, smoke test y rollback.

## Respaldos

- **Snapshots automáticos de RDS**: diarios, 7 días (`backup_retention_period = 7`).
- **mysqldump diario a S3**: `infra/scripts/backup-mysql-to-s3.sh` por cron a las 03:30 de Lima.
- **Prueba de restauración por entrega**: `infra/scripts/restore-test.sh` compara conteos producción/restaurada.

## Modo mantenimiento

```bash
docker compose exec app php artisan down --secret="<token-secreto>" --retry=30
# … migraciones o mantenimiento …
docker compose exec app php artisan up
```
Durante el mantenimiento la API responde 503 con `Retry-After: 30` y el frontend muestra la pantalla 503.

Guía paso a paso para migrar de Render a AWS (cuenta, Terraform, datos, DNS, apagado): [`docs/migracion-aws.md`](../docs/migracion-aws.md).
