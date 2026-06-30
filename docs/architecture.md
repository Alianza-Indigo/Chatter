# Arquitectura

## Principio rector

Whalabi es una **capa de producto sobre Matrix/Synapse**, no un sistema de
mensajería propio. La separación de responsabilidades es estricta:

| Responsabilidad | Dueño |
|-----------------|-------|
| Usuarios, autenticación, sesiones Matrix | **Synapse** |
| Rooms, membresías, eventos, mensajes | **Synapse** |
| Sincronización en tiempo real (`/sync`) | **Synapse** (vía SDK) |
| Resolución de tenant por dominio | API Whalabi |
| Configuración de tenant, branding, LLM | API Whalabi |
| Orquestación del bot | Bot Whalabi |
| Logs operativos del bot | API/DB Whalabi |
| Web Push (opcional) | API Whalabi + Service Worker |

> **No** se crean tablas propias para mensajes como fuente principal. **No** se
> duplica la Client-Server API. **No** se inventan webhooks Matrix. El bot escucha
> por `/sync`.

## Componentes

### `apps/web` — Frontend (PWA)

Next.js 14 (App Router) + TypeScript + Tailwind. Toda la mensajería se hace en el
cliente con `matrix-js-sdk` a través del wrapper `@whalabi/matrix`. Flujo:

1. Al cargar, `TenantProvider` resuelve el tenant llamando a la API
   (`GET /api/config/public?domain=…`) y aplica branding (CSS variables).
2. `MatrixProvider` restaura la sesión persistida (localStorage) y arranca el sync.
3. Login/registro usan la API real de Matrix (no la API de Whalabi).
4. Los componentes se suscriben a actualizaciones de rooms y timelines emitidas por
   el wrapper.

### `apps/api` — API auxiliar

Fastify + Prisma + Zod. **No** envía mensajes Matrix en el flujo del usuario. Expone:

```
GET   /health
GET   /api/tenant/resolve?domain=…
GET   /api/tenant/current
GET   /api/config/public
POST  /api/admin/tenants          (x-admin-token)
GET   /api/admin/tenants
GET   /api/admin/tenants/:id
PATCH /api/admin/tenants/:id
GET   /api/admin/bot/logs
POST  /api/admin/bot/test
```

La configuración pública nunca incluye secretos (API keys, passwords).

### `apps/bot` — Bot inteligente

`matrix-bot-sdk`. Se loguea como usuario Matrix, escucha por `/sync`, responde solo
en DMs o por mención, limita tasa por room, mantiene contexto acotado y registra logs
operativos. El LLM es intercambiable vía la interfaz `LLMProvider`.

### `packages/shared`

Tipos de dominio (`Tenant`, `PublicTenantConfig`, `BotLog`, `LLMInput/Output`),
esquemas Zod y utilidades puras (normalización de dominio, detección de menciones,
prompt base del bot).

### `packages/matrix`

`WhalabiMatrixClient`: wrapper delgado sobre `matrix-js-sdk` con
`login/register/logout/restore`, `getRooms/createRoom/invite/joinRoom`,
`sendMessage/getTimeline/loadOlderMessages/markRead`, `startSync/stopSync`,
`getProfile/setDisplayName` y suscripciones para React.

## Flujo de un mensaje

```
Usuario A (web)  ──sendEvent()──▶  Synapse  ──/sync──▶  Usuario B (web)
                                      │
                                      └──/sync──▶  Bot ──LLM──▶ sendText() ──▶ Synapse
```

Whalabi nunca está en la ruta del mensaje. La API solo participa en configuración y
logs.

## Diagrama de despliegue

```
                 ┌─────────── Nginx (TLS, por dominio de tenant) ───────────┐
   navegador ───▶│  /            → web (Next.js)                            │
                 │  /api         → api (Fastify)                            │
                 │  /_matrix     → synapse                                  │
                 │  /.well-known → descubrimiento Matrix                    │
                 └──────────────────────────────────────────────────────────┘
                         │              │                 │
                       web            api ── postgres-app │
                                        │                 │
                                       bot ───────────────┘ (logs)
                                        │
                                     synapse ── postgres-synapse
```
