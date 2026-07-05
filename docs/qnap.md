# Whalabi en QNAP (TS-563) — prueba COMPLETA con Cloudflare Tunnel

Guía para correr Whalabi **entero** (registro con CAPTCHA, PWA instalable, push y
llamadas) en un **QNAP TS-563** (AMD x86-64, 16 GB) usando **Container Station** y
**Cloudflare Tunnel** para el HTTPS — sin abrir puertos del router ni chocar con
los puertos de QTS.

> El TS-563 es x86-64: las imágenes Docker corren nativas. 16 GB sobran.

## Cómo encaja el HTTPS y las llamadas

- **Cloudflare Tunnel** da HTTPS a la web, la API, Synapse y ntfy. Con eso
  funcionan **PWA, service worker, registro con CAPTCHA y push**.
- **Las llamadas usan TURN/UDP (coturn), que NO pasa por el túnel** (Cloudflare
  solo transporta HTTP/S). Por eso las llamadas se prueban por **LAN**: coturn
  corre en el NAS y ambos dispositivos deben estar en tu red local, apuntando a
  la **IP del NAS** (`TURN_HOST`). Para llamadas por internet habría que abrir
  UDP en el router (fuera del alcance de esta prueba).

## 0) Requisitos

- **Container Station** (App Center) y **SSH** habilitado (Panel de control → SSH).
- Un **dominio en Cloudflare** y un subdominio de prueba, p. ej. `nas.tudominio.com`
  (no reutilices el de producción).
- Claves **reCAPTCHA v2** (Google reCAPTCHA admin) para el registro con CAPTCHA:
  registra el subdominio y guarda *site key* y *secret*.

## 1) Crear el Cloudflare Tunnel

1. Cloudflare **Zero Trust → Networks → Tunnels → Create tunnel** (tipo *Cloudflared*).
2. Copia el **token** del túnel (lo usarás en `CLOUDFLARE_TUNNEL_TOKEN`).
3. En **Public Hostnames** del túnel, añade dos entradas apuntando al Caddy interno:

   | Hostname | Service |
   |----------|---------|
   | `nas.tudominio.com` | `http://caddy-tunnel:80` |
   | `ntfy.nas.tudominio.com` | `http://caddy-tunnel:80` |

   (Los dos al mismo Caddy; el `Caddyfile.tunnel` los separa por Host.)

## 2) Clonar y configurar `.env`

```bash
git clone https://github.com/Alianza-Indigo/Chatter.git whalabi
cd whalabi
cp .env.example .env
```

Edita `.env` (con `nano .env`). Ajusta estos valores — sustituye el dominio y la
IP LAN del NAS:

```bash
DOMAIN=nas.tudominio.com
NAS_IP=192.168.1.50        # IP del QNAP en tu LAN

# Dominio y URLs públicas (todo bajo el mismo origen HTTPS del túnel)
WHALABI_DOMAIN=$DOMAIN
APP_PUBLIC_URL=https://$DOMAIN
CORS_ORIGIN=https://$DOMAIN
NEXT_PUBLIC_API_URL=                                   # vacío = mismo origen (/api)
NEXT_PUBLIC_MATRIX_HOMESERVER_URL=https://$DOMAIN
MATRIX_DEFAULT_SERVER_NAME=$DOMAIN                      # MXIDs @usuario:nas.tudominio.com

# Cloudflare Tunnel
CLOUDFLARE_TUNNEL_TOKEN=pega-aqui-el-token

# CAPTCHA (reCAPTCHA v2)
RECAPTCHA_PUBLIC_KEY=tu-site-key
RECAPTCHA_PRIVATE_KEY=tu-secret

# Llamadas (LAN): coturn en el NAS
TURN_SHARED_SECRET=genera-uno
TURN_HOST=$NAS_IP
TURN_EXTERNAL_IP=$NAS_IP

# Aislamiento entre organizaciones (bloqueo de contacto cruzado)
INTERNAL_API_SECRET=genera-uno
ISOLATION_EXEMPT_USERS=@whalabi-bot:$DOMAIN
```

Genera los secretos fuertes y pégalos donde dice "genera-uno":

```bash
openssl rand -hex 32     # uno para TURN_SHARED_SECRET
openssl rand -hex 32     # uno para INTERNAL_API_SECRET
openssl rand -hex 32     # ADMIN_API_TOKEN
openssl rand -hex 32     # ADMIN_JWT_SECRET / APP_ENCRYPTION_KEY / MATRIX_REGISTRATION_SHARED_SECRET
```

Y **cambia las contraseñas por defecto** de Postgres en `infra/docker-compose.yml`
si esto va a durar (para una prueba corta puedes dejarlas).

### Push (VAPID) — opcional pero para probar push

```bash
docker run --rm node:20-alpine npx --yes web-push generate-vapid-keys
```

Copia el par a `.env`:

```
VAPID_PUBLIC_KEY=...          # el "Public Key"
NEXT_PUBLIC_VAPID_PUBLIC_KEY=...   # el mismo Public Key
VAPID_PRIVATE_KEY=...         # el "Private Key"
VAPID_SUBJECT=mailto:tu@correo.com
```

## 3) Config de Synapse + infra base

```bash
./infra/scripts/init-synapse.sh
docker compose -f infra/docker-compose.yml up -d postgres-synapse postgres-app synapse coturn
```

## 4) Base de datos + usuarios

```bash
docker compose -f infra/docker-compose.yml run --rm api pnpm prisma migrate deploy
docker compose -f infra/docker-compose.yml run --rm api pnpm db:seed

# Usuarios de prueba (sin captcha, vía Admin API)
./infra/scripts/create-admin-user.sh cesar       S3cret!
./infra/scripts/create-admin-user.sh whalabi-bot BotS3cret!
# pon BOT_PASSWORD=BotS3cret! en .env
```

## 5) Levantar TODO (apps + ntfy + Caddy-túnel + cloudflared)

```bash
docker compose -f infra/docker-compose.yml --profile full --profile cloudflare up -d --build
```

(La build de `web` en el APU GX-420MC tarda varios minutos: normal.)

Abre **`https://nas.tudominio.com`** desde cualquier lado:
- **Registro con CAPTCHA**, login, mensajería, sync.
- **Instalar la PWA** (ya es contexto seguro HTTPS).
- **Admin** en `/admin` con tu `ADMIN_API_TOKEN`: crea organizaciones con/sin código.
- **Push**: activa notificaciones en el navegador.

## 6) Probar llamadas (por LAN)

Con `TURN_HOST` = IP del NAS, abre la web en **dos dispositivos de tu misma LAN**
e inicia una llamada. El media va directo al coturn del NAS (no por Cloudflare).

- Si coturn no arranca en Container Station por el *host networking*, revisa que
  el contenedor tenga permisos de red del host; es un servicio con
  `network_mode: host` que usa 3478 y 49160-49200/UDP.
- Fuera de la LAN las llamadas necesitarían abrir esos puertos UDP en el router.

## 7) Verificaciones útiles

```bash
# El módulo de aislamiento cargó:
docker compose -f infra/docker-compose.yml logs synapse | grep -i WhalabiIsolation
# El túnel conectó:
docker compose -f infra/docker-compose.yml logs cloudflared | tail
# Bloqueo entre organizaciones (tras crear una org con código y un usuario en ella):
SECRET=$(grep -E '^INTERNAL_API_SECRET=' .env | cut -d= -f2-)
curl -s -H "x-internal-secret: $SECRET" \
  "http://localhost:4000/api/internal/may-contact?from=@cesar:nas.tudominio.com&to=@ana:nas.tudominio.com"
```

## RAM (16 GB sobra)

| Proceso | Uso típico |
|---------|-----------|
| Synapse | 0.5–1.5 GB |
| Postgres ×2 | 0.3–0.8 GB c/u |
| web/api/bot (Node) | 0.2–0.4 GB c/u |
| coturn / cloudflared / caddy / ntfy | pequeños |

## Limpieza

```bash
docker compose -f infra/docker-compose.yml --profile full --profile cloudflare down
# borrar datos también:
docker compose -f infra/docker-compose.yml --profile full --profile cloudflare down -v
```

## Notas

- El APU GX-420MC es modesto: ideal para **prueba/demo con pocos usuarios**.
- Si el test se vuelve permanente, respalda **ambos** Postgres (el de Synapse
  contiene los mensajes).
