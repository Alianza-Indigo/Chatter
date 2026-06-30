# Whalabi

> **El chat privado de tu organización.**
> PWA de mensajería organizacional privada, sin número telefónico, construida como
> una **capa de producto moderna sobre Matrix + Synapse**.

Whalabi **no** es un sistema de chat propietario. La fuente de verdad de usuarios,
rooms, mensajes, membresías y sincronización es **Matrix/Synapse**. El backend de
Whalabi solo resuelve tenants por dominio, guarda configuración, administra branding
y proveedor LLM, y orquesta un bot inteligente opcional.

Cada usuario se identifica con una **identidad Matrix**: `@usuario:dominio`
(ej. `@cesar:whalabi.app`, `@doctor:clinica-demo.mx`).

---

## Arquitectura

Monorepo `pnpm`:

```
whalabi/
├── apps/
│   ├── web/    # Frontend Next.js + PWA (matrix-js-sdk)
│   ├── api/    # API auxiliar Fastify + Prisma (tenants, bot logs)
│   └── bot/    # Bot inteligente (matrix-bot-sdk + LLM)
├── packages/
│   ├── shared/ # Tipos + esquemas Zod + utilidades
│   └── matrix/ # Wrapper de matrix-js-sdk para el frontend
├── infra/      # docker-compose, Synapse, Nginx, scripts
└── docs/       # Documentación
```

Principio crítico: **no se implementa backend de mensajería propio**. Ver
[`docs/architecture.md`](docs/architecture.md).

---

## Stack

- **Frontend:** Next.js 14 (App Router), TypeScript, TailwindCSS, PWA, `matrix-js-sdk`.
- **Backend:** Node.js, TypeScript, Fastify, Prisma, PostgreSQL, Zod.
- **Matrix:** Synapse (Docker) con su propio PostgreSQL.
- **Bot:** Node.js, TypeScript, `matrix-bot-sdk`, abstracción `LLMProvider`
  (OpenAI-compatible / Ollama / dummy).
- **Infra:** Docker Compose, Nginx (proxy sugerido), scripts de provisioning.

---

## Inicio rápido (desarrollo)

Requisitos: Node ≥ 20, pnpm 9, Docker.

```bash
pnpm install
cp .env.example .env

# 1) Infraestructura: bases de datos + Synapse
./infra/scripts/init-synapse.sh
docker compose -f infra/docker-compose.yml up -d postgres-synapse postgres-app synapse

# 2) Base de datos de la app
pnpm db:generate
pnpm db:migrate
pnpm db:seed            # crea tenants default + demo

# 3) Usuarios Matrix de prueba
./infra/scripts/create-admin-user.sh admin S3cret!
./infra/scripts/create-admin-user.sh cesar S3cret!
./infra/scripts/create-admin-user.sh whalabi-bot BotS3cret!

# 4) Arrancar todo en modo dev (web + api + bot)
pnpm dev
```

Abre <http://localhost:3000>, inicia sesión con `cesar` / `S3cret!`, crea un room,
envía mensajes e invita al bot (`@whalabi-bot:whalabi.local`).

Más detalle: [`docs/install.md`](docs/install.md).

---

## Documentación

| Documento | Contenido |
|-----------|-----------|
| [architecture.md](docs/architecture.md) | Arquitectura, límites y flujo de datos |
| [install.md](docs/install.md) | Instalación y desarrollo paso a paso |
| [deployment.md](docs/deployment.md) | Despliegue self-hosted / administrado |
| [matrix.md](docs/matrix.md) | Synapse, registro, federación, E2EE |
| [bot.md](docs/bot.md) | Bot inteligente y proveedores LLM |
| [multi-tenant.md](docs/multi-tenant.md) | Modelo multi-tenant por dominio |
| [qnap.md](docs/qnap.md) | Pruebas en NAS QNAP (Container Station) |
| [testing-checklist.md](docs/testing-checklist.md) | Checklist de pruebas manuales |

---

## Privacidad y seguridad (resumen)

- Whalabi **no usa número telefónico**; identidad = Matrix ID.
- Los mensajes pertenecen al homeserver Matrix del tenant. **No se guardan en
  PostgreSQL propio como fuente de verdad.**
- El bot solo accede a rooms donde fue **invitado** y solo procesa mensajes donde
  participa (DM o mención).
- El proveedor LLM es configurable por tenant (externo, BYOK o local).
- **No se simula E2EE.** El alcance del cifrado está documentado en
  [`docs/matrix.md`](docs/matrix.md).
- No se usan logos, colores ni marca de WhatsApp.

## Licencia

MIT.
