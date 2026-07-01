# Matrix / Synapse

Whalabi usa **Synapse** como homeserver Matrix. No se reimplementa la
Client-Server API ni se inventan webhooks.

## Configuración

La plantilla `infra/synapse-config/homeserver.yaml.template` se renderiza con
`init-synapse.sh` usando variables del `.env`. La config versionada vive en
`infra/synapse-config/` (fuera del volumen de datos), y el script la renderiza/copia
hacia `infra/synapse/` (el volumen en vivo, propiedad del usuario del contenedor).
Así `git pull` nunca escribe dentro de la carpeta de datos de Synapse. Puntos clave:

- **Base de datos:** PostgreSQL (`postgres-synapse`), no SQLite, para producción.
- **Listener:** puerto `8008` HTTP (TLS terminado en el proxy).
- **Registro:** auto-registro abierto protegido con reCAPTCHA v2
  (`enable_registration_captcha`), configurable por tenant en Whalabi.
- **Federación:** cerrada por defecto (`federation_domain_whitelist: []`). Para una
  instancia privada por organización, mantenerla cerrada.
- **URL preview:** deshabilitado por privacidad.

## Registro de usuarios

Tres caminos:

1. **Provisioning administrativo** (recomendado para organizaciones cerradas):
   `register_new_matrix_user` o la Admin API con `registration_shared_secret`.
2. **Token de registro:** activar `enable_registration: true` +
   `registration_requires_token: true`; el frontend pide el token en el registro.
3. **Registro abierto:** solo si el tenant tiene `allowRegistration: true` y el
   homeserver lo permite. El frontend muestra el formulario; si Synapse lo rechaza,
   se informa al usuario.

> El flag `allowRegistration` del tenant controla la **UI**. La política real la
> impone Synapse. Ambos deben estar alineados.

## Identidad

La identidad es el **Matrix ID**: `@localpart:server_name`. No hay número
telefónico. El `server_name` proviene de la configuración del tenant
(`matrixServerName`).

## E2EE — alcance honesto

**Este scaffold NO habilita ni simula cifrado de extremo a extremo (E2EE).**

- `encryption_enabled_by_default_for_room_type: off` en la plantilla.
- El wrapper `matrix-js-sdk` se usa sin crypto/Olm en esta versión.
- Los mensajes están protegidos en tránsito por TLS y en reposo según la seguridad
  del homeserver, **no** con E2EE.

Si se requiere E2EE real, debe implementarse explícitamente (inicializar el crypto
store del SDK, gestión de claves y verificación de dispositivos) y documentarse el
modelo de respaldo de claves. **No prometer E2EE completo hasta entonces.**

## Multi-homeserver

- **Modo A (compartido):** un Synapse, varios tenants distinguidos por configuración
  de Whalabi. Todos los MXID comparten `server_name`.
- **Modo B (por tenant):** cada tenant define su propio `matrixBaseUrl` y
  `matrixServerName`. El frontend y el bot usan los del tenant resuelto.

La configuración soporta ambos; la primera implementación corre con un Synapse local.
