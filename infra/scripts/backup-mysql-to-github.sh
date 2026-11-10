#!/bin/bash
# Copia de seguridad de la base MySQL local (Docker) a un repositorio PRIVADO de GitHub.
# El volcado se comprime y se cifra (AES-256, clave BACKUP_KEY de api/.env) antes de salir del equipo:
# aunque alguien viera el repositorio, no podría leer DNI, teléfonos ni correos sin la clave.
#
#   bash infra/scripts/backup-mysql-to-github.sh          → respalda, sube y deja los últimos 30
#   bash infra/scripts/restore-from-github.sh             → prueba que el último respaldo se restaura
#
# Mientras no exista el servidor en AWS, esto reemplaza a backup-mysql-to-s3.sh.
set -euo pipefail

ROOT=$(cd "$(dirname "$0")/../.." && pwd)
ENV_FILE=${ENV_FILE:-$ROOT/api/.env}
REPO_URL=${BACKUP_REPO_URL:-https://github.com/Josephml23/LeGrandHotel-backup.git}
REPO_DIR=${BACKUP_REPO_DIR:-$ROOT/../LeGrandHotel-backup}
CONTAINER=${MYSQL_CONTAINER:-legrandhotel-mysql-1}
KEEP=${BACKUP_KEEP:-30}

# Clave de cifrado: se crea la primera vez y nunca se imprime. Sin ella no se puede restaurar:
# guárdala también fuera de este equipo (por ejemplo, en un gestor de contraseñas).
if ! grep -qE '^BACKUP_KEY=.+' "$ENV_FILE"; then
  sed -i '/^BACKUP_KEY=/d' "$ENV_FILE"
  printf '\n# Clave de cifrado de los respaldos (infra/scripts/backup-mysql-to-github.sh)\nBACKUP_KEY=%s\n' "$(openssl rand -base64 48 | tr -d '\n')" >> "$ENV_FILE"
  echo "Se creó BACKUP_KEY en api/.env. Guárdala también fuera del equipo: sin ella no se puede restaurar."
fi
BACKUP_KEY=$(grep -E '^BACKUP_KEY=' "$ENV_FILE" | tail -1 | cut -d= -f2-)
export BACKUP_KEY

if [ ! -d "$REPO_DIR/.git" ]; then
  git clone --quiet "$REPO_URL" "$REPO_DIR"
fi
git -C "$REPO_DIR" pull --quiet --rebase 2>/dev/null || true

STAMP=$(date -u +%Y%m%dT%H%M%SZ)
MONTH=$(date -u +%Y-%m)
mkdir -p "$REPO_DIR/mysql/$MONTH"
NAME="mysql/$MONTH/legrandhotel-$STAMP.sql.gz.enc"

# --single-transaction: copia consistente sin bloquear al hotel. La clave de MySQL no sale del contenedor.
docker exec "$CONTAINER" sh -c 'MYSQL_PWD="$MYSQL_PASSWORD" exec mysqldump -u"$MYSQL_USER" --single-transaction --routines --triggers --no-tablespaces "$MYSQL_DATABASE"' \
  | gzip -9 \
  | openssl enc -aes-256-cbc -pbkdf2 -iter 200000 -salt -pass env:BACKUP_KEY -out "$REPO_DIR/$NAME"

# Conteo de registros (sin datos personales) para comprobar la restauración.
COUNTS=$(docker exec "$CONTAINER" sh -c 'MYSQL_PWD="$MYSQL_PASSWORD" mysql -N -u"$MYSQL_USER" "$MYSQL_DATABASE" -e "
  SELECT CONCAT(\"users=\", COUNT(*)) FROM users UNION ALL
  SELECT CONCAT(\"clients=\", COUNT(*)) FROM clients UNION ALL
  SELECT CONCAT(\"rooms=\", COUNT(*)) FROM rooms UNION ALL
  SELECT CONCAT(\"reservations=\", COUNT(*)) FROM reservations UNION ALL
  SELECT CONCAT(\"inventory_items=\", COUNT(*)) FROM inventory_items"' | tr '\n' ' ')
SIZE=$(wc -c < "$REPO_DIR/$NAME" | tr -d ' ')
SHA=$(sha256sum "$REPO_DIR/$NAME" | cut -d' ' -f1)
echo "$STAMP $NAME bytes=$SIZE sha256=$SHA $COUNTS" >> "$REPO_DIR/mysql/indice.txt"
echo "$NAME" > "$REPO_DIR/mysql/ULTIMO"

# Los respaldos se guardan tal cual, sin convertir saltos de línea.
[ -f "$REPO_DIR/.gitattributes" ] || echo "* -text" > "$REPO_DIR/.gitattributes"

if [ ! -f "$REPO_DIR/README.md" ]; then
  cat > "$REPO_DIR/README.md" <<'EOF'
# Respaldos de LeGrandHotel (privado)

Volcados de MySQL comprimidos y cifrados con AES-256 (`openssl enc -aes-256-cbc -pbkdf2 -iter 200000`).
La clave es `BACKUP_KEY` del `api/.env` del proyecto; sin ella los archivos no se pueden leer.

- `mysql/AAAA-MM/legrandhotel-<fecha>.sql.gz.enc`: un archivo por respaldo (se guardan los últimos 30).
- `mysql/indice.txt`: fecha, tamaño, SHA-256 y conteo de registros de cada respaldo.
- `mysql/ULTIMO`: el respaldo más reciente.

Se generan con `infra/scripts/backup-mysql-to-github.sh` y se prueban con `infra/scripts/restore-from-github.sh`.
EOF
fi

# Retención: se borran los más antiguos (siguen en el historial de git).
ls "$REPO_DIR"/mysql/*/legrandhotel-*.sql.gz.enc | sort | head -n -"$KEEP" | while read -r old; do
  git -C "$REPO_DIR" rm --quiet "$old"
done

git -C "$REPO_DIR" add -A
git -C "$REPO_DIR" commit --quiet -m "Respaldo $STAMP"
git -C "$REPO_DIR" push --quiet origin HEAD

echo "Respaldo subido: $NAME ($SIZE bytes) · $COUNTS"
