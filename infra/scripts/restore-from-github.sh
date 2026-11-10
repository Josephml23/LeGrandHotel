#!/bin/bash
# Prueba de restauración: descarga el último respaldo del repositorio privado, lo descifra, lo carga en una
# base temporal del contenedor MySQL y compara el conteo de registros con la base actual. Luego borra la temporal.
#   bash infra/scripts/restore-from-github.sh [mysql/AAAA-MM/legrandhotel-....sql.gz.enc]
set -euo pipefail

ROOT=$(cd "$(dirname "$0")/../.." && pwd)
ENV_FILE=${ENV_FILE:-$ROOT/api/.env}
REPO_DIR=${BACKUP_REPO_DIR:-$ROOT/../LeGrandHotel-backup}
CONTAINER=${MYSQL_CONTAINER:-legrandhotel-mysql-1}
TEMP_DB=legrandhotel_restore_test

BACKUP_KEY=$(grep -E '^BACKUP_KEY=' "$ENV_FILE" | tail -1 | cut -d= -f2-)
[ -n "$BACKUP_KEY" ] || { echo "Falta BACKUP_KEY en $ENV_FILE"; exit 1; }
export BACKUP_KEY

git -C "$REPO_DIR" pull --quiet --rebase
FILE=${1:-$(tr -d "\r" < "$REPO_DIR/mysql/ULTIMO")}
echo "Restaurando $FILE en la base temporal $TEMP_DB"

root_sql() { docker exec -i "$CONTAINER" sh -c 'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" exec mysql -N -uroot '"$1"; }

echo "DROP DATABASE IF EXISTS $TEMP_DB; CREATE DATABASE $TEMP_DB;" | root_sql ""
openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 -pass env:BACKUP_KEY -in "$REPO_DIR/$FILE" | gunzip | root_sql "$TEMP_DB"

printf "%-18s %10s %10s\n" "tabla" "actual" "restaurada"
for t in users clients rooms reservations inventory_items; do
  a=$(echo "SELECT COUNT(*) FROM legrandhotel.$t" | root_sql "")
  b=$(echo "SELECT COUNT(*) FROM $TEMP_DB.$t" | root_sql "")
  printf "%-18s %10s %10s\n" "$t" "$a" "$b"
done

echo "DROP DATABASE $TEMP_DB;" | root_sql ""
echo "Restauración correcta. (Si hubo cambios después del respaldo, «actual» puede ser mayor.)"
