#!/usr/bin/env bash
# Inicializa Synapse: genera config base y aplica la plantilla de Whalabi.
#
# Uso:
#   ./infra/scripts/init-synapse.sh
#
# Requiere Docker. Lee variables del .env de la raíz si existe.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
# Volumen de datos en vivo de Synapse (propiedad del usuario del contenedor, UID 991).
SYNAPSE_DIR="$ROOT_DIR/infra/synapse"
# Config versionada en git (propiedad de quien clona el repo). Se mantiene FUERA
# del volumen para que `git pull` nunca tenga que escribir dentro de una carpeta
# que no le pertenece (esa era la causa de los conflictos de permisos en deploy).
CONFIG_DIR="$ROOT_DIR/infra/synapse-config"

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

echo "==> Aplicando config de Whalabi (homeserver.yaml + log.config)…"

# 2) Renderizar la plantilla (desde CONFIG_DIR, versionada) hacia el volumen.
#    El paso `generate` deja $SYNAPSE_DIR como propiedad del usuario de Synapse
#    (UID 991), así que se escribe con `sudo tee`: el archivo queda legible por
#    Synapse y la carpeta sigue siendo suya para escribir sus datos en runtime.
#    git nunca toca $SYNAPSE_DIR porque la fuente vive en $CONFIG_DIR.
: "${RECAPTCHA_PUBLIC_KEY:=}"
: "${RECAPTCHA_PRIVATE_KEY:=}"
: "${TURN_SHARED_SECRET:=}"
export MATRIX_DEFAULT_SERVER_NAME APP_PUBLIC_URL MATRIX_REGISTRATION_SHARED_SECRET
export RECAPTCHA_PUBLIC_KEY RECAPTCHA_PRIVATE_KEY TURN_SHARED_SECRET

# Escribe stdin al destino usando sudo solo si el archivo destino (o su carpeta,
# si no existe) no es escribible por el usuario actual. Checar el ARCHIVO, no solo
# la carpeta: un homeserver.yaml de un render previo puede ser de root aunque la
# carpeta sea escribible.
write_to() {
  local target="$1"
  if { [[ -e "$target" && -w "$target" ]] || { [[ ! -e "$target" ]] && [[ -w "$(dirname "$target")" ]]; }; }; then
    tee "$target" > /dev/null
  else
    sudo tee "$target" > /dev/null
  fi
}

envsubst '${MATRIX_DEFAULT_SERVER_NAME} ${APP_PUBLIC_URL} ${MATRIX_REGISTRATION_SHARED_SECRET} ${RECAPTCHA_PUBLIC_KEY} ${RECAPTCHA_PRIVATE_KEY} ${TURN_SHARED_SECRET}' \
  < "$CONFIG_DIR/homeserver.yaml.template" \
  | write_to "$SYNAPSE_DIR/homeserver.yaml"

# Copiar log.config al volumen (homeserver.yaml lo referencia como /data/log.config).
write_to "$SYNAPSE_DIR/log.config" < "$CONFIG_DIR/log.config"

echo "==> Listo. Arranca Synapse con:"
echo "    docker compose -f infra/docker-compose.yml up -d postgres-synapse synapse"
