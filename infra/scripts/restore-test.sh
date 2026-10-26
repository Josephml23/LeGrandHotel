#!/bin/bash
# Prueba de restauración (una vez por entrega): restaura el último respaldo en una BD temporal
# y compara el conteo de registros con producción. Ejecutar desde una EC2 de la VPC.
#   ./restore-test.sh            → usa el respaldo más reciente
set -euo pipefail

ENV_FILE=${ENV_FILE:-/opt/legrandhotel/.env}
set -a; . "$ENV_FILE"; set +a
TEMP_DB=legrandhotel_restore_test

LATEST=$(aws s3 ls "s3://${BACKUP_BUCKET}/mysql/" --recursive | grep '\.sql\.gz$' | sort | tail -1 | awk '{print $4}')
echo "Restaurando s3://${BACKUP_BUCKET}/${LATEST} en ${TEMP_DB}"

export MYSQL_PWD="$DB_PASSWORD"
mysql -h "$DB_HOST" -u "$DB_USERNAME" -e "DROP DATABASE IF EXISTS ${TEMP_DB}; CREATE DATABASE ${TEMP_DB};"
aws s3 cp "s3://${BACKUP_BUCKET}/${LATEST}" - | gunzip | mysql -h "$DB_HOST" -u "$DB_USERNAME" "$TEMP_DB"

printf "%-22s %12s %12s\n" "tabla" "producción" "restaurada"
for t in users clients rooms reservations stays inventory_items audit_logs; do
  a=$(mysql -N -h "$DB_HOST" -u "$DB_USERNAME" "$DB_DATABASE" -e "SELECT COUNT(*) FROM $t")
  b=$(mysql -N -h "$DB_HOST" -u "$DB_USERNAME" "$TEMP_DB" -e "SELECT COUNT(*) FROM $t")
  printf "%-22s %12s %12s\n" "$t" "$a" "$b"
done

mysql -h "$DB_HOST" -u "$DB_USERNAME" -e "DROP DATABASE ${TEMP_DB};"
echo "Copia la tabla anterior en la documentación de la entrega."
