#!/usr/bin/env bash
# Backup de Whalabi: ambos Postgres (app + Synapse) y el media store de Matrix.
#
# Uso:
#   ./infra/scripts/backup.sh [directorio-destino]
# Por defecto guarda en ./backups/<timestamp>/
#
# Recomendado: cron diario + copiar fuera del servidor.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
COMPOSE="docker compose -f $ROOT_DIR/infra/docker-compose.yml"
STAMP="$(date +%Y%m%d-%H%M%S)"
DEST="${1:-$ROOT_DIR/backups/$STAMP}"

mkdir -p "$DEST"
echo "==> Backup en $DEST"

echo "  - Postgres app (whalabi)…"
$COMPOSE exec -T postgres-app pg_dump -U whalabi -d whalabi | gzip > "$DEST/app-db.sql.gz"

echo "  - Postgres Synapse (mensajes)…"
$COMPOSE exec -T postgres-synapse pg_dump -U synapse -d synapse | gzip > "$DEST/synapse-db.sql.gz"

echo "  - Media store de Matrix…"
if $COMPOSE exec -T synapse test -d /data/media_store 2>/dev/null; then
  $COMPOSE exec -T synapse tar czf - -C /data media_store > "$DEST/synapse-media.tar.gz" || \
    echo "    (media store vacío o no accesible; se omite)"
fi

# Config (sin secretos en claro: el .env NO se respalda aquí a propósito)
cp "$ROOT_DIR/infra/synapse/homeserver.yaml" "$DEST/homeserver.yaml" 2>/dev/null || true

echo "==> Backup completado:"
ls -lh "$DEST"
echo ""
echo "IMPORTANTE: copia este directorio FUERA del servidor y guarda tu .env"
echo "(contiene APP_ENCRYPTION_KEY, necesaria para descifrar secretos al restaurar)."
