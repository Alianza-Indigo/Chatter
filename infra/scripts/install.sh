#!/usr/bin/env bash
# Instalador de Whalabi para un VPS limpio (Docker + Docker Compose requeridos).
#
# Uso:
#   PUBLIC_URL=https://chat.tu-org.com ./infra/scripts/install.sh
#   # o para pruebas por IP:
#   PUBLIC_URL=http://TU_IP:3000 MATRIX_URL=http://TU_IP:8008 API_URL=http://TU_IP:4000 ./infra/scripts/install.sh
#
# Genera secretos, inicializa Synapse, migra, siembra datos, crea usuarios admin
# y bot, y levanta toda la plataforma. Idempotente en lo posible.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
COMPOSE="docker compose -f $ROOT_DIR/infra/docker-compose.yml"
cd "$ROOT_DIR"

command -v docker >/dev/null || { echo "Falta Docker."; exit 1; }
docker compose version >/dev/null || { echo "Falta Docker Compose."; exit 1; }

PUBLIC_URL="${PUBLIC_URL:-http://localhost:3000}"
API_URL="${API_URL:-$PUBLIC_URL}"
MATRIX_URL="${MATRIX_URL:-$PUBLIC_URL}"
SERVER_NAME="${SERVER_NAME:-whalabi.local}"

echo "==> 1/8 Preparando .env"
[[ -f .env ]] || cp .env.example .env
# Docker Compose busca el .env junto al compose (infra/). Symlink para que
# `docker compose -f infra/docker-compose.yml` cargue el .env de la raíz.
ln -sf ../.env infra/.env
gen() { openssl rand -hex "${1:-24}"; }
setkv() { # setkv KEY VALUE  (solo si está vacío o es placeholder change-me/localhost)
  local k="$1" v="$2" cur
  cur="$(grep -E "^$k=" .env | cut -d= -f2- || true)"
  if [[ -z "$cur" || "$cur" == change-me* || "$cur" == "http://localhost:3000" || "$cur" == "whalabi.local" ]]; then
    sed -i "s#^$k=.*#$k=$v#" .env
  fi
}
BOT_PASS="$(gen 16)"; ADMIN_PASS="$(gen 12)"
setkv APP_ENCRYPTION_KEY "$(gen 32)"
setkv ADMIN_API_TOKEN "$(gen 24)"
setkv ADMIN_JWT_SECRET "$(openssl rand -base64 48 | tr -d '/+=')"
setkv MATRIX_REGISTRATION_SHARED_SECRET "$(gen 32)"
# URLs siempre se fijan a lo indicado
sed -i "s#^APP_PUBLIC_URL=.*#APP_PUBLIC_URL=$PUBLIC_URL#" .env
sed -i "s#^NEXT_PUBLIC_API_URL=.*#NEXT_PUBLIC_API_URL=$API_URL#" .env
sed -i "s#^NEXT_PUBLIC_MATRIX_HOMESERVER_URL=.*#NEXT_PUBLIC_MATRIX_HOMESERVER_URL=$MATRIX_URL#" .env
sed -i "s#^CORS_ORIGIN=.*#CORS_ORIGIN=$PUBLIC_URL#" .env
sed -i "s#^MATRIX_DEFAULT_SERVER_NAME=.*#MATRIX_DEFAULT_SERVER_NAME=$SERVER_NAME#" .env
sed -i "s#^BOT_PASSWORD=.*#BOT_PASSWORD=$BOT_PASS#" .env
sed -i "s#^MATRIX_ADMIN_USER=.*#MATRIX_ADMIN_USER=@admin:$SERVER_NAME#" .env
sed -i "s#^MATRIX_ADMIN_PASSWORD=.*#MATRIX_ADMIN_PASSWORD=$ADMIN_PASS#" .env
sed -i "s#^BOT_DISPLAY_NAME=.*#BOT_DISPLAY_NAME=\"Whalabi Bot\"#" .env

echo "==> 2/8 Generando config de Synapse"
./infra/scripts/init-synapse.sh

echo "==> 3/8 Levantando bases de datos y Synapse"
$COMPOSE up -d postgres-synapse postgres-app synapse
sleep 20

echo "==> 4/8 Migrando base de datos de la app"
$COMPOSE run --rm api pnpm prisma migrate deploy

echo "==> 5/8 Sembrando datos (tenants demo)"
$COMPOSE run --rm api pnpm db:seed || true

echo "==> 6/8 Creando usuarios Matrix (admin + bot)"
./infra/scripts/create-admin-user.sh admin "$ADMIN_PASS"
./infra/scripts/create-admin-user.sh whalabi-bot "$BOT_PASS"

echo "==> 7/8 Ajustando URL pública del tenant default"
$COMPOSE exec -T postgres-app psql -U whalabi -d whalabi -c \
  "UPDATE \"Tenant\" SET \"matrixBaseUrl\"='$MATRIX_URL' WHERE slug='default';" || true

echo "==> 8/8 Construyendo y levantando apps"
$COMPOSE --profile full up -d --build

echo ""
echo "======================================================================"
echo " Whalabi instalado."
echo "   Web:            $PUBLIC_URL"
echo "   Usuario admin Matrix:  @admin:$SERVER_NAME  /  $ADMIN_PASS"
echo "   Token panel admin:     $(grep '^ADMIN_API_TOKEN=' .env | cut -d= -f2)"
echo ""
echo " GUARDA tu archivo .env: contiene APP_ENCRYPTION_KEY y credenciales."
echo " Para HTTPS con dominio, añade el perfil caddy (ver docs/oracle.md)."
echo "======================================================================"
