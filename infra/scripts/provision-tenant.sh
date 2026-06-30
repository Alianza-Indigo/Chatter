#!/usr/bin/env bash
# Provisiona un tenant: crea su registro en la API de Whalabi y, opcionalmente,
# el usuario bot en Synapse.
#
# Uso:
#   ./infra/scripts/provision-tenant.sh <slug> <nombre> <dominio>
# Ejemplo:
#   ./infra/scripts/provision-tenant.sh clinica-demo "Clínica Demo" chat.clinica-demo.mx
#
# Variables relevantes del .env:
#   API_PORT, ADMIN_API_TOKEN, MATRIX_DEFAULT_HOMESERVER_URL, MATRIX_DEFAULT_SERVER_NAME
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
if [[ -f "$ROOT_DIR/.env" ]]; then
  set -a; source "$ROOT_DIR/.env"; set +a
fi

SLUG="${1:?Uso: provision-tenant.sh <slug> <nombre> <dominio>}"
NAME="${2:?Uso: provision-tenant.sh <slug> <nombre> <dominio>}"
DOMAIN="${3:?Uso: provision-tenant.sh <slug> <nombre> <dominio>}"

API_BASE="http://localhost:${API_PORT:-4000}"
ADMIN_TOKEN="${ADMIN_API_TOKEN:-change-me-admin-api-token}"
HS_URL="${MATRIX_DEFAULT_HOMESERVER_URL:-http://localhost:8008}"
SERVER_NAME="${MATRIX_DEFAULT_SERVER_NAME:-whalabi.local}"

echo "==> Creando tenant '$SLUG' ($NAME / $DOMAIN) en $API_BASE…"

curl -fsS -X POST "$API_BASE/api/admin/tenants" \
  -H "content-type: application/json" \
  -H "x-admin-token: $ADMIN_TOKEN" \
  -d @- <<JSON
{
  "name": "$NAME",
  "slug": "$SLUG",
  "publicDomain": "$DOMAIN",
  "matrixBaseUrl": "$HS_URL",
  "matrixServerName": "$SERVER_NAME",
  "botEnabled": true,
  "botUserId": "@whalabi-bot:$SERVER_NAME",
  "botResponseMode": "mention",
  "llmProvider": "dummy",
  "allowRegistration": false
}
JSON

echo ""
echo "==> Tenant '$SLUG' provisionado."
echo "    Para crear su usuario bot dedicado en Synapse, ejecuta:"
echo "    ./infra/scripts/create-admin-user.sh whalabi-bot <password-del-bot>"
