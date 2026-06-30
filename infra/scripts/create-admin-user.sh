#!/usr/bin/env bash
# Crea un usuario administrador en Synapse usando register_new_matrix_user.
#
# Uso:
#   ./infra/scripts/create-admin-user.sh <usuario> <password>
# Ejemplo:
#   ./infra/scripts/create-admin-user.sh admin S3cret!
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
if [[ -f "$ROOT_DIR/.env" ]]; then
  set -a; source "$ROOT_DIR/.env"; set +a
fi

USER="${1:?Uso: create-admin-user.sh <usuario> <password>}"
PASS="${2:?Uso: create-admin-user.sh <usuario> <password>}"
HS_URL="${MATRIX_DEFAULT_HOMESERVER_URL:-http://localhost:8008}"

echo "==> Creando usuario admin '$USER' en $HS_URL…"

docker compose -f "$ROOT_DIR/infra/docker-compose.yml" exec -T synapse \
  register_new_matrix_user \
    -u "$USER" \
    -p "$PASS" \
    -a \
    -c /data/homeserver.yaml \
    "$HS_URL"

echo "==> Usuario admin creado: @${USER}:${MATRIX_DEFAULT_SERVER_NAME:-whalabi.local}"
