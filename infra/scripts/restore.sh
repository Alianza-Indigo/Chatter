#!/usr/bin/env bash
# Restauración de Whalabi desde un backup creado con backup.sh.
#
# Uso:
#   ./infra/scripts/restore.sh <directorio-de-backup>
#
# ¡DESTRUCTIVO! Sobrescribe las bases de datos actuales. Úsalo con cuidado.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
COMPOSE="docker compose -f $ROOT_DIR/infra/docker-compose.yml"
SRC="${1:?Uso: restore.sh <directorio-de-backup>}"

[[ -f "$SRC/app-db.sql.gz" ]] || { echo "No se encuentra $SRC/app-db.sql.gz"; exit 1; }

echo "⚠️  Esto SOBRESCRIBE las bases de datos actuales desde: $SRC"
read -r -p "Escribe 'RESTAURAR' para continuar: " confirm
[[ "$confirm" == "RESTAURAR" ]] || { echo "Cancelado."; exit 1; }

echo "==> Asegurando que las DB están arriba…"
$COMPOSE up -d postgres-app postgres-synapse
sleep 5

echo "==> Restaurando Postgres app…"
gunzip -c "$SRC/app-db.sql.gz" | $COMPOSE exec -T postgres-app psql -U whalabi -d whalabi

echo "==> Restaurando Postgres Synapse…"
gunzip -c "$SRC/synapse-db.sql.gz" | $COMPOSE exec -T postgres-synapse psql -U synapse -d synapse

if [[ -f "$SRC/synapse-media.tar.gz" ]]; then
  echo "==> Restaurando media store…"
  $COMPOSE exec -T synapse sh -c 'cat > /tmp/media.tar.gz && tar xzf /tmp/media.tar.gz -C /data && rm /tmp/media.tar.gz' < "$SRC/synapse-media.tar.gz" || \
    echo "  (no se pudo restaurar media; continúa)"
fi

echo "==> Reiniciando servicios…"
$COMPOSE restart synapse api bot 2>/dev/null || true
echo "==> Restauración completada."
