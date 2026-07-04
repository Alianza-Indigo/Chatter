# Organizaciones (multitenant)

La **Organización** es la entidad de primer nivel de Whalabi (en el modelo es el
`Tenant`). Reúne en un solo lugar su **personalidad** (nombre, marca, bot, LLM) y
su **forma de acceso**:

- **Con código (aislada)** → sus miembros se registran con el código y **solo se
  ven entre ellos**; tiene su propio espacio Matrix.
- **Sin código (general)** → sus miembros entran **sin** código al espacio
  general y se ven con todos los demás sin código.

Regla para el usuario final al registrarse:

- **No escribe código** → entra a la organización general (la resuelta por
  dominio, normalmente **Whalabi**).
- **Escribe un código válido** → entra **solo** a esa organización.

## Cómo se refuerza (no es cosmético)

1. **Descubrimiento.** En Synapse `user_directory.search_all_users: false`: solo
   encuentras a quien **comparte un espacio** contigo. Whalabi une a cada quien al
   espacio de su organización (force-join vía Admin API).
2. **Contacto (direccionabilidad).** Aunque alguien conozca un MXID exacto de otra
   organización, un **módulo de Synapse** (`whalabi_isolation.py`) intercepta cada
   invitación (`user_may_invite`) y la permite **solo si ambos comparten
   organización**. Consulta a la API interna:

   ```
   Synapse (módulo) ──GET /api/internal/may-contact?from=&to=──▶ API Whalabi
                                                                    │
                                             índice OrgMembership ◀─┘
   ```

Ambas capas usan el índice **`OrgMembership`** (MXID → organización/tenant), que
se registra al unirse y en el backfill.

## Piezas

- **`Tenant`** (Prisma) = la organización. Campos nuevos: `code` (null = general,
  único cuando existe) y `spaceId` (su espacio Matrix, se crea al primer ingreso).
  `publicDomain` es opcional (por ahora se distingue por código, no por dominio).
- **`OrgMembership`**: `{ userId (MXID, único), tenantId }`.
- **API**
  - `GET  /api/org/check?code=` — valida un código **antes** de registrar. `{ valid, name? }`.
  - `POST /api/org/join` — `Authorization: Bearer <access token Matrix>` + `{ code? }`.
    Confirma identidad con `whoami`, resuelve la organización y hace force-join.
  - `GET  /api/internal/may-contact` — usado por el módulo de Synapse (secreto).
  - `POST /api/admin/tenants` / `PATCH …/:id` — crear/editar organización.
  - `POST /api/admin/tenants/:id/backfill` — une usuarios existentes a esta org.
- **Web**: una sola pestaña **Organizaciones** en el admin (personalidad +
  con/sin código); campo *Código de organización* (opcional) en el registro.

## Alta de una organización

1. Panel admin → **Organizaciones** → **+ Nueva**.
2. Pon el **nombre** y su personalidad (marca, bot, LLM), y elige el **acceso**:
   con código (aislada) o sin código (general).
3. Comparte el código (si aplica) con sus integrantes.

## Variables de entorno del aislamiento

- **`INTERNAL_API_SECRET`**: secreto compartido con el módulo (cabecera
  `x-internal-secret`). Vacío = bloqueo por servidor deshabilitado.
- **`ISOLATION_EXEMPT_USERS`**: MXIDs que nunca se bloquean (bot, soporte).
- **`fail_open: true`** (config del módulo): si la API no responde, la invitación
  se permite; ponlo en `false` para máxima privacidad.

Requiere `PYTHONPATH=/data` en el contenedor de Synapse (ya en el compose) e
`init-synapse.sh` copia el módulo al volumen.

## Rollout en un servidor con usuarios existentes

Al activar `search_all_users: false`, las cuentas creadas antes no están en
ningún espacio. En la organización **general** (Whalabi), pulsa **"Unir usuarios
existentes a esta organización"** (o `POST /api/admin/tenants/:id/backfill`) una vez.

---

## Dominio propio por organización (más adelante)

Hoy todas las organizaciones conviven en **un solo dominio** (whalabi.app) y se
distinguen por **código**. El campo `publicDomain` queda para el futuro: darle a
cada organización su propio subdominio (`acme.whalabi.app`) con aislamiento total.

### Resolución por dominio (general / pre-login)

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
