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
| `ADMIN_API_TOKEN` | Token estático para el primer login admin |
| `ADMIN_JWT_SECRET` | Firma los JWT de administración (`POST /api/admin/login`) |
| `APP_ENCRYPTION_KEY` | Cifra secretos en reposo (`llmApiKey`). **Defínela en producción** |
| `CORS_ORIGIN` | Orígenes del frontend permitidos |
| `LLM_PROVIDER` / `LLM_API_KEY` / `LLM_BASE_URL` / `LLM_MODEL` | Proveedor LLM por defecto |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `VAPID_SUBJECT` | Web Push (genera con `npx web-push generate-vapid-keys`) |
| `BOT_*` | Credenciales y comportamiento del bot |

## Autenticación de administración

`/api/admin/*` acepta dos credenciales:

1. **Recomendado:** un **JWT** (`Authorization: Bearer <jwt>`) firmado con
   `ADMIN_JWT_SECRET`. Se obtiene en `POST /api/admin/login` enviando el
   `ADMIN_API_TOKEN`; el JWT vive 12 h.
2. **Bootstrap/compatibilidad:** el token estático `x-admin-token: <ADMIN_API_TOKEN>`.

```bash
# Obtener un JWT
curl -X POST $API/api/admin/login -H 'content-type: application/json' \
  -d '{"token":"'"$ADMIN_API_TOKEN"'"}'
# -> { "token": "<jwt>", "tokenType": "Bearer", "expiresIn": 43200 }
```

## Secretos en reposo

Las claves BYOK del LLM (`llmApiKey` por tenant) se **cifran con AES-256-GCM**
usando `APP_ENCRYPTION_KEY` antes de guardarse en Postgres. Sin esa variable, se
guardan en texto plano (solo aceptable en desarrollo). Genera una clave fuerte:

```bash
openssl rand -base64 48
```

> Nota: si rotas `APP_ENCRYPTION_KEY`, los secretos cifrados con la clave anterior
> dejan de poder descifrarse; re-introdúcelos vía `PATCH /api/admin/tenants/:id`.

## Web Push

Whalabi implementa el ciclo completo de Web Push (suscripción + envío VAPID):

1. Genera claves VAPID y ponlas en `VAPID_*`.
2. El frontend ofrece "Activar notificaciones" en Configuración.
3. Prueba el envío real: `POST /api/admin/push/test` con `{ tenantId, userId, message }`.

> **Alcance:** el envío automático ante **cada** mensaje de Matrix requiere un
> notificador (p. ej. **Sygnal** como push gateway, o un hook desde el bot). El
> servicio de envío (`sendToUser`) y el endpoint de prueba ya están listos; la
> fuente de eventos Matrix se conecta aparte.

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
