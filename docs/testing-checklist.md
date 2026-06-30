# Checklist de pruebas manuales

Tras `pnpm dev` con la infraestructura levantada y usuarios de prueba creados:

## Configuración / arranque

- [ ] `docker compose ... up -d postgres-synapse postgres-app synapse` levanta sin errores.
- [ ] `http://localhost:8008/health` responde `OK`.
- [ ] `pnpm db:migrate` aplica el esquema sin errores.
- [ ] `pnpm db:seed` crea los tenants `default`, `clinica-demo`, `despacho-demo`.
- [ ] `GET http://localhost:4000/health` responde `{ status: "ok", db: true }`.

## Tenant / branding

- [ ] La web carga en `http://localhost:3000` y muestra branding del tenant `default`.
- [ ] `GET /api/config/public?domain=chat.clinica-demo.mx` devuelve el tenant correcto.
- [ ] El color primario del tenant se refleja en la UI (botones, acentos).

## Autenticación

- [ ] Login con `cesar` / `S3cret!` funciona y redirige a `/chat`.
- [ ] Credenciales inválidas muestran "Usuario o contraseña incorrectos."
- [ ] Recargar la página mantiene la sesión (persistencia en localStorage).
- [ ] En un tenant con `allowRegistration: false`, `/register` muestra
      "El registro está controlado por tu organización."
- [ ] En un tenant con registro abierto, se puede crear una cuenta nueva.

## Rooms y mensajería (Matrix)

- [ ] La lista de rooms muestra los rooms del usuario.
- [ ] "Nuevo room" crea un room y lo selecciona.
- [ ] Enviar un mensaje lo muestra inmediatamente (estado de envío en el botón).
- [ ] Abrir el mismo room con otro usuario refleja los mensajes **en tiempo real**
      (vía `/sync`, sin recargar).
- [ ] Los mensajes propios y ajenos se diferencian visualmente.
- [ ] Se muestran fecha/hora y el scroll baja al último mensaje.
- [ ] Invitar a otro usuario por MXID funciona.

## Bot

- [ ] El bot (`@whalabi-bot:...`) inicia sesión (revisar logs del proceso bot).
- [ ] Botón "+ Bot" invita al bot al room activo (muestra advertencia de privacidad).
- [ ] Mencionar al bot genera una respuesta en el mismo room.
- [ ] En un DM con el bot, responde sin necesidad de mención.
- [ ] El bot **no** responde a mensajes que no lo mencionan en rooms grupales.
- [ ] El bot no entra en loop respondiéndose a sí mismo.
- [ ] `GET /api/admin/bot/logs` muestra entradas con estados (`received`, `responded`, …)
      y **sin contenido** si `BOT_STORE_CONTENT=false`.
- [ ] `POST /api/admin/bot/test` responde (eco en modo `dummy`, respuesta real con LLM).

## PWA / tema

- [ ] El navegador ofrece instalar la PWA (botón "Instalar app").
- [ ] Instalada, la app abre en modo standalone.
- [ ] El service worker se registra (`/sw.js`).
- [ ] Sin conexión, el shell carga y `/offline` se muestra en navegación fallida.
- [ ] El toggle de tema cambia entre claro y oscuro y persiste tras recargar.

## Configuración

- [ ] `/settings` muestra Matrix ID, dispositivo, homeserver y datos del tenant.
- [ ] "Cerrar sesión" invalida la sesión y redirige a `/login`.

## Seguridad / privacidad

- [ ] La configuración pública del tenant **no** incluye `llmApiKey` ni passwords.
- [ ] `/api/admin/*` rechaza peticiones sin `x-admin-token` válido (401).
- [ ] No existen tablas de mensajes en la DB de la app (solo Tenant, BotLog, PushSubscription).
