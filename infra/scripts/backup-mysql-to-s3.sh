#!/bin/bash
# Respaldo lógico diario de RDS a S3 (complementa los snapshots automáticos de 7 días).
# Lo ejecuta cron en las EC2; un lock en S3 evita que dos instancias respalden el mismo día.
set -euo pipefail

ENV_FILE=${ENV_FILE:-/opt/legrandhotel/.env}
set -a; . "$ENV_FILE"; set +a

DAY=$(date -u +%Y-%m-%d)
STAMP=$(date -u +%Y%m%dT%H%M%SZ)
LOCK="s3://${BACKUP_BUCKET}/mysql/locks/${DAY}.lock"
TARGET="s3://${BACKUP_BUCKET}/mysql/${DAY}/legrandhotel-${STAMP}.sql.gz"

if aws s3 ls "$LOCK" >/dev/null 2>&1; then
  echo "Respaldo del ${DAY} ya realizado por otra instancia."
  exit 0
fi
echo "$(hostname) ${STAMP}" | aws s3 cp - "$LOCK"

# mysqldump de la imagen oficial mysql:8.4, la misma versión que RDS: el cliente de MariaDB que trae
# Amazon Linux no entiende --set-gtid-purged ni, según la versión, la autenticación caching_sha2_password.
# --single-transaction: copia consistente sin bloquear la operación del hotel.
# --no-tablespaces: el usuario de RDS no tiene el privilegio PROCESS que pide volcar tablespaces.
export MYSQL_PWD="$DB_PASSWORD"
docker run --rm -e MYSQL_PWD mysql:8.4 mysqldump \
  --host="$DB_HOST" --user="$DB_USERNAME" \
  --single-transaction --routines --triggers --set-gtid-purged=OFF --no-tablespaces \
  "$DB_DATABASE" | gzip -9 | aws s3 cp - "$TARGET" --sse AES256

echo "Respaldo subido a ${TARGET}"
