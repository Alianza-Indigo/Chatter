#!/usr/bin/env bash
# Inicializa Synapse: genera config base y aplica la plantilla de Whalabi.
#
# Uso:
#   ./infra/scripts/init-synapse.sh
#
# Requiere Docker. Lee variables del .env de la raíz si existe.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SYNAPSE_DIR="$ROOT_DIR/infra/synapse"

# Cargar .env si existe
if [[ -f "$ROOT_DIR/.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "$ROOT_DIR/.env"
  set +a
fi

: "${MATRIX_DEFAULT_SERVER_NAME:=whalabi.local}"
: "${APP_PUBLIC_URL:=http://localhost:3000}"
: "${MATRIX_REGISTRATION_SHARED_SECRET:=change-me-registration-secret}"

echo "==> Generando configuración base de Synapse para '$MATRIX_DEFAULT_SERVER_NAME'…"

# 1) Generar config inicial (crea signing key, etc.) si no existe homeserver.yaml
if [[ ! -f "$SYNAPSE_DIR/homeserver.yaml" ]]; then
  docker run --rm \
    -v "$SYNAPSE_DIR:/data" \
    -e SYNAPSE_SERVER_NAME="$MATRIX_DEFAULT_SERVER_NAME" \
    -e SYNAPSE_REPORT_STATS=no \
    matrixdotorg/synapse:latest generate
fi

echo "==> Aplicando plantilla de Whalabi (homeserver.yaml)…"

# 2) Renderizar la plantilla con sustitución de variables.
export MATRIX_DEFAULT_SERVER_NAME APP_PUBLIC_URL MATRIX_REGISTRATION_SHARED_SECRET
envsubst '${MATRIX_DEFAULT_SERVER_NAME} ${APP_PUBLIC_URL} ${MATRIX_REGISTRATION_SHARED_SECRET}' \
  < "$SYNAPSE_DIR/homeserver.yaml.template" \
  > "$SYNAPSE_DIR/homeserver.yaml"

echo "==> Listo. Arranca Synapse con:"
echo "    docker compose -f infra/docker-compose.yml up -d postgres-synapse synapse"
