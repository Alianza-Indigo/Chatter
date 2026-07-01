#!/usr/bin/env bash
# Actualiza Whalabi: hace backup, trae cambios, reconstruye y aplica migraciones.
#
# Uso:
#   ./infra/scripts/update.sh
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
COMPOSE="docker compose -f $ROOT_DIR/infra/docker-compose.yml"
cd "$ROOT_DIR"

echo "==> 1/5 Backup previo…"
./infra/scripts/backup.sh || echo "  (backup falló o DB no arriba; continúa bajo tu responsabilidad)"

echo "==> 2/5 Trayendo cambios (git pull)…"
git pull --ff-only

echo "==> 3/5 Reconstruyendo imágenes…"
$COMPOSE build api bot web

echo "==> 4/5 Aplicando migraciones de base de datos…"
$COMPOSE run --rm api pnpm prisma migrate deploy

echo "==> 5/5 Reiniciando servicios…"
$COMPOSE --profile full up -d

echo "==> Actualización completada."
$COMPOSE ps
