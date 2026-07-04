# Multi-tenant

Whalabi tiene **dos niveles** de multitenancy que se combinan:

1. **Tenant por dominio** (branding/config): cada dominio resuelve un `Tenant`
   con su logo, colores, bot y homeserver. Ver más abajo.
2. **Organización por código** (aislamiento de personas dentro de un tenant):
   modelo híbrido descrito en la siguiente sección.

---

## Organizaciones por "código" (multitenant híbrido)

Regla de producto:

- **Sin código de organización** → el usuario entra al espacio **Global** y se
  descubre/escribe con todos (estilo WhatsApp).
- **Con código de organización** → el usuario queda **acotado a esa organización**:
  solo ve y busca a sus integrantes; nadie de fuera lo encuentra.

### Cómo se refuerza (no es cosmético)

En Synapse se fija `user_directory.search_all_users: false`. Con eso, un usuario
solo puede descubrir a personas con las que **comparte un espacio**. Whalabi une
a cada quien al espacio correcto según su registro:

| Registro | Espacio al que se une | A quién puede descubrir |
|----------|-----------------------|--------------------------|
| sin código | Espacio **Global** del tenant | a todos los del Global |
| con código válido | Espacio de esa **organización** | solo a su organización |

Los espacios son privados y no listados: sus miembros no aparecen en el
directorio global. El aislamiento lo impone Synapse, no la app.

### Piezas

- **Modelo `Organization`** (Prisma): `{ tenantId, name, code, spaceId }`. El
  código es único por tenant y se normaliza a minúsculas.
- **`Tenant.globalSpaceId`**: Espacio Global del tenant (se crea al vuelo).
- **API**
  - `GET  /api/org/check?code=` — valida un código **antes** de registrar
    (evita cuentas huérfanas). Devuelve `{ valid, name? }`.
  - `POST /api/org/join` — `Authorization: Bearer <access token Matrix>` + `{ code? }`.
    La API confirma la identidad con `whoami`, resuelve el espacio y hace
    **force-join** vía la Synapse Admin API. Código vacío → Global.
  - `GET/POST /api/admin/tenants/:id/orgs` — listar/crear organizaciones (admin).
  - `POST /api/admin/tenants/:id/global/backfill` — une a los usuarios ya
    existentes al Global (usar **una vez** al activar el multitenant).
- **Web**: campo *Código de organización* (opcional) en el registro; el provider
  llama a `/api/org/join` tras crear la cuenta; panel admin para gestionar
  códigos dentro de cada tenant.

### Alta de una organización

1. En el panel admin, abre el tenant y ve a **Organizaciones (códigos)**.
2. Crea la organización con un nombre (y opcionalmente un código; si no, se
   genera del nombre). Se crea automáticamente su Espacio Matrix aislado.
3. Comparte el código con sus integrantes. Al registrarse con él, quedan dentro.

### Bloqueo de contacto cruzado (refuerzo en el servidor)

`search_all_users:false` evita que te **descubran** de otra organización, pero
quien conociera un MXID exacto (`@juan:whalabi.app`) podría invitarlo/DM aunque
no compartan espacio. Para cerrarlo, un **módulo de Synapse**
(`infra/synapse-config/whalabi_isolation.py`) intercepta cada invitación
(`user_may_invite`) y la permite **solo si ambos comparten organización** (o
ambos son Globales). La decisión la toma consultando la API interna:

```
Synapse (módulo) ──GET /api/internal/may-contact?from=&to=──▶ API Whalabi
                                                                 │
                                          índice OrgMembership ◀─┘
```

- **`OrgMembership`** (Prisma): a qué organización pertenece cada MXID
  (`organizationId` null = Global). Se registra al unirse y en el backfill.
- **`INTERNAL_API_SECRET`**: secreto compartido (cabecera `x-internal-secret`).
  Vacío = bloqueo por servidor deshabilitado (el descubrimiento acotado sigue).
- **`ISOLATION_EXEMPT_USERS`**: MXIDs que nunca se bloquean (bot, soporte).
- **`fail_open: true`**: si la API no responde, la invitación se permite (para no
  romper la mensajería); ponlo en `false` para máxima privacidad.

Requiere `PYTHONPATH=/data` en el contenedor de Synapse (ya en el compose) y que
`init-synapse.sh` copie el módulo al volumen (ya lo hace). Tras cambiar el
template, regenera y reinicia Synapse.

### Rollout en un servidor con usuarios existentes

Al activar `search_all_users: false`, las cuentas creadas antes no están en
ningún espacio y dejarían de descubrirse. Pulsa **"Unir usuarios existentes al
espacio Global"** (o `POST /api/admin/tenants/:id/global/backfill`) una vez.

---

## Tenant por dominio

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
