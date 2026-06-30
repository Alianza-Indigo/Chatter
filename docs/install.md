# Instalación y desarrollo

## Requisitos

- Node.js ≥ 20
- pnpm 9 (`corepack enable && corepack prepare pnpm@9 --activate`)
- Docker + Docker Compose

## 1. Dependencias y entorno

```bash
pnpm install
cp .env.example .env
```

Ajusta `.env`. Para desarrollo local los valores por defecto funcionan, salvo que
quieras un proveedor LLM real (ver `docs/bot.md`).

## 2. Infraestructura (Postgres + Synapse)

Genera la configuración de Synapse y levanta las bases de datos + homeserver:

```bash
./infra/scripts/init-synapse.sh
docker compose -f infra/docker-compose.yml up -d postgres-synapse postgres-app synapse
```

Comprueba Synapse: <http://localhost:8008/health> debe responder `OK`.

> Puertos por defecto: Synapse `8008`, Postgres-Synapse `5432`, Postgres-App `5433`.
> El `DATABASE_URL` del `.env` apunta a `5433`.

## 3. Base de datos de la app

```bash
pnpm db:generate     # genera el cliente Prisma (api y bot)
pnpm db:migrate      # crea/migra el esquema en postgres-app
pnpm db:seed         # tenants: default, clinica-demo, despacho-demo
```

> El bot usa el mismo esquema Prisma; genera su cliente con
> `pnpm --filter @whalabi/bot db:generate` (incluido en `pnpm db:generate` si lo
> añades, o ejecútalo una vez).

## 4. Usuarios Matrix de prueba

```bash
./infra/scripts/create-admin-user.sh admin S3cret!
./infra/scripts/create-admin-user.sh cesar S3cret!
./infra/scripts/create-admin-user.sh whalabi-bot BotS3cret!
```

Pon `BOT_PASSWORD=BotS3cret!` en `.env` para que el bot inicie sesión.

## 5. Arrancar en desarrollo

```bash
pnpm dev        # web (3000) + api (4000) + bot
```

O por separado:

```bash
pnpm dev:api
pnpm dev:web
pnpm dev:bot
```

## 6. Probar

1. Abre <http://localhost:3000>.
2. Login con `cesar` / `S3cret!`.
3. Crea un room, invita a `@admin:whalabi.local`.
4. Envía mensajes; ábrelo en otra sesión/usuario para ver el sync en tiempo real.
5. Invita al bot (`@whalabi-bot:whalabi.local`) con el botón **+ Bot** y mencionalo.

Consulta `docs/testing-checklist.md` para la lista completa.

## Problemas frecuentes

- **El frontend no resuelve tenant:** verifica que la API esté arriba en `:4000` y
  `NEXT_PUBLIC_API_URL` apunte ahí. Si la API no responde, la web cae a una
  configuración por defecto basada en `NEXT_PUBLIC_MATRIX_*`.
- **Login falla con `M_FORBIDDEN`:** usuario/contraseña incorrectos, o el homeserver
  no coincide. Revisa `MATRIX_DEFAULT_HOMESERVER_URL`.
- **El bot no responde:** confirma `BOT_ENABLED=true`, credenciales válidas y que el
  bot fue invitado al room. Revisa logs con `GET /api/admin/bot/logs`.
