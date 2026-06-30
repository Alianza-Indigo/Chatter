# Multi-tenant por dominio

Whalabi resuelve el tenant a partir del **dominio** desde el que se accede:

```
dominio visitante  →  tenant resolver  →  configuración Matrix del tenant
```

Ejemplos:

| Dominio | Tenant |
|---------|--------|
| `chat.clinica-demo.mx` | `clinica-demo` |
| `chat.despacho-demo.com` | `despacho-demo` |
| `whalabi.app` / `localhost` | `default` |

## Resolución

- Frontend: `TenantProvider` llama a `GET /api/config/public?domain=<hostname>`.
- Backend: `resolveTenantByDomain` busca por `publicDomain` exacto (normalizado) y,
  si no hay match, cae al tenant `default`.
- El dominio se normaliza (minúsculas, sin protocolo/puerto/barra final).

## Configuración por tenant

Modelo `Tenant` (Prisma) — campos principales:

```
id, name, slug, publicDomain
matrixBaseUrl, matrixServerName
botUserId, botEnabled, botSystemPrompt, botResponseMode
llmProvider, llmModel, llmBaseUrl, llmApiKey (secreto)
primaryColor, accentColor, logoUrl, tagline   (branding)
allowRegistration
createdAt, updatedAt
```

La **configuración pública** (`PublicTenantConfig`) que recibe el frontend excluye
todo secreto (`llmApiKey`, etc.).

## Branding

`primaryColor` y `accentColor` se aplican como CSS variables
(`--whalabi-primary`, `--whalabi-accent`) en runtime. La paleta base es índigo +
lavanda + gris oscuro + blanco, con modo oscuro real.

## Modos de homeserver

- **Modo A — Synapse compartido:** todos los tenants usan el mismo
  `matrixBaseUrl`/`matrixServerName`; se separan por configuración de Whalabi.
- **Modo B — Synapse por tenant:** cada tenant define su homeserver. El frontend y el
  bot usan la URL del tenant resuelto. Puede ejecutarse un bot por tenant.

La arquitectura soporta ambos sin cambios de código: solo difiere la configuración
de cada `Tenant`.

## Provisioning

```bash
./infra/scripts/provision-tenant.sh clinica-demo "Clínica Demo" chat.clinica-demo.mx
```

Crea el tenant vía la Admin API. Para su usuario bot dedicado, crear el usuario en
Synapse y ajustar `botUserId`.

## Administración

Endpoints `/api/admin/*` (protegidos por `x-admin-token`):

- `POST /api/admin/tenants` — crear
- `GET /api/admin/tenants` — listar
- `GET /api/admin/tenants/:id` — detalle
- `PATCH /api/admin/tenants/:id` — actualizar
- `GET /api/admin/bot/logs` — logs del bot (filtrables por tenant/room/status)
- `POST /api/admin/bot/test` — probar el LLM del tenant
