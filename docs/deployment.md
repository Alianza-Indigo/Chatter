# Despliegue

Whalabi está diseñado para evolucionar hacia tres modelos:

1. **Self-hosted por cliente** — la organización corre todo (incluido Synapse).
2. **Instancia administrada por Whalabi** — Synapse compartido, tenants lógicos.
3. **Synapse por organización** — un homeserver dedicado por tenant.

## Despliegue completo con Docker Compose

```bash
cp .env.example .env        # ajusta secretos de producción
./infra/scripts/init-synapse.sh

# Bases de datos + Synapse
docker compose -f infra/docker-compose.yml up -d postgres-synapse postgres-app synapse

# Crear usuarios admin/bot
./infra/scripts/create-admin-user.sh admin '<password>'
./infra/scripts/create-admin-user.sh whalabi-bot '<password-bot>'

# Apps (perfil full construye api, bot, web)
docker compose -f infra/docker-compose.yml --profile full up -d --build

# Reverse proxy (opcional)
docker compose -f infra/docker-compose.yml --profile proxy up -d
```

La API aplica `prisma migrate deploy` al arrancar (ver `apps/api/Dockerfile`).

## Variables de producción imprescindibles

| Variable | Nota |
|----------|------|
| `MATRIX_DEFAULT_SERVER_NAME` | Nombre de servidor Matrix (parte del MXID) |
| `MATRIX_REGISTRATION_SHARED_SECRET` | Secreto para provisioning |
| `ADMIN_API_TOKEN` | Protege `/api/admin/*` |
| `ADMIN_JWT_SECRET` | Reservado para sesiones de panel (futuro) |
| `CORS_ORIGIN` | Orígenes del frontend permitidos |
| `LLM_PROVIDER` / `LLM_API_KEY` / `LLM_BASE_URL` / `LLM_MODEL` | Proveedor LLM |
| `BOT_*` | Credenciales y comportamiento del bot |

## TLS y dominios de tenant

Termina TLS en el reverse proxy (`infra/nginx/whalabi.conf`). Cada tenant apunta su
dominio (`chat.clinica-demo.mx`) al proxy. La resolución de tenant usa el `Host` de la
petición (`/api/tenant/current`) o el parámetro `?domain=`.

Para descubrimiento Matrix, sirve `/.well-known/matrix/client` y `/server` (el proxy
de ejemplo ya los expone).

## Health checks

- API: `GET /health` → `{ status, db }`.
- Synapse: `GET /health`.
- Compose define `healthcheck` para Postgres y Synapse.

## Escalado y notas

- Synapse puede escalarse con workers (no incluido aquí; ver docs oficiales).
- Para multi-homeserver (modo B), cada tenant define su `matrixBaseUrl` propio; el
  frontend y el bot usan esa URL. El bot puede ejecutarse por tenant con su propio
  conjunto de variables `BOT_*`.
- Backups: respaldar **ambos** Postgres. El de Synapse contiene los mensajes; el de
  la app, la configuración.
