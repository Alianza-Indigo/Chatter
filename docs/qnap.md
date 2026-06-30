# Pruebas en QNAP (Container Station)

Guía para correr Whalabi en un NAS **QNAP** (probado en mente para **TS-563**,
CPU AMD x86-64, 16 GB RAM) usando **Container Station**.

> El TS-563 es **x86-64**, así que las imágenes Docker (`matrixdotorg/synapse`,
> `postgres`, `node`) corren nativas — sin el tema de ARM de otras nubes.

## Requisitos

- **Container Station** instalado (App Center de QTS).
- **RAM:** 8 GB mínimo; **16 GB recomendado** (este NAS lo tiene → suficiente para
  Synapse + 2 Postgres + 3 apps).
- Acceso **SSH** habilitado (Panel de control → Telnet/SSH) — es la vía más cómoda.
- `git` y `docker compose` disponibles (Container Station los provee; vía SSH se
  usa `docker compose`).

## Puertos: evita chocar con QTS

QTS ya usa **80 / 443 / 8080**. Para pruebas **no levantes el reverse proxy**
(perfil `proxy`). Usa los puertos directos:

| Servicio | Puerto | URL de prueba |
|----------|--------|---------------|
| web      | 3000   | `http://IP-DEL-NAS:3000` |
| api      | 4000   | `http://IP-DEL-NAS:4000` |
| Synapse  | 8008   | `http://IP-DEL-NAS:8008` |
| Postgres app | 5433 | interno |
| Postgres synapse | 5432 | interno |

Si alguno choca con otra app del NAS, cámbialo en `infra/docker-compose.yml`.

## Pasos (vía SSH)

```bash
# 1) Clonar
git clone https://github.com/Alianza-Indigo/Chatter.git whalabi
cd whalabi

# 2) Entorno — usa la IP del NAS para que el navegador alcance Synapse y la API
cp .env.example .env
NAS_IP=192.168.1.50   # <-- la IP de tu QNAP en la LAN
sed -i "s#NEXT_PUBLIC_API_URL=.*#NEXT_PUBLIC_API_URL=http://$NAS_IP:4000#"                       .env
sed -i "s#NEXT_PUBLIC_MATRIX_HOMESERVER_URL=.*#NEXT_PUBLIC_MATRIX_HOMESERVER_URL=http://$NAS_IP:8008#" .env
sed -i "s#APP_PUBLIC_URL=.*#APP_PUBLIC_URL=http://$NAS_IP:3000#"                                 .env
sed -i "s#CORS_ORIGIN=.*#CORS_ORIGIN=http://$NAS_IP:3000#"                                       .env
# server_name puede quedar como whalabi.local (es solo el sufijo del MXID)

# 3) Generar config de Synapse + levantar infra
./infra/scripts/init-synapse.sh
docker compose -f infra/docker-compose.yml up -d postgres-synapse postgres-app synapse

# 4) Base de datos de la app
docker compose -f infra/docker-compose.yml run --rm api pnpm prisma migrate deploy
docker compose -f infra/docker-compose.yml run --rm api pnpm db:seed

# 5) Usuarios Matrix de prueba
./infra/scripts/create-admin-user.sh cesar       S3cret!
./infra/scripts/create-admin-user.sh whalabi-bot BotS3cret!
# pon BOT_PASSWORD=BotS3cret! en .env

# 6) Apps (web + api + bot), SIN proxy
docker compose -f infra/docker-compose.yml --profile full up -d --build
```

Abre `http://IP-DEL-NAS:3000` y prueba login, rooms, sync y bot.

## Alternativa: Container Station por interfaz

Si prefieres no usar SSH:

1. Container Station → **Create** → **Application**.
2. Pega el contenido de `infra/docker-compose.yml`.
3. Define las variables de entorno (las del `.env`) en la sección de variables.
4. Quita/omite el servicio `nginx` (perfil `proxy`).
5. Crea y arranca.

> Por SSH es más fácil porque los scripts (`init-synapse.sh`,
> `create-admin-user.sh`) automatizan la config y los usuarios.

## RAM: reparto orientativo (16 GB sobra)

| Proceso | Uso típico |
|---------|-----------|
| Synapse | 0.5–1.5 GB |
| Postgres ×2 | 0.3–0.8 GB c/u |
| web + api + bot (Node) | 0.2–0.4 GB c/u |

Total en reposo de pruebas: ~3–4 GB. Tienes margen de sobra.

## HTTPS y PWA (importante)

El **chat y el sync funcionan sobre HTTP** en la LAN, pero **instalar la PWA y el
service worker NO** funcionan sobre `http://IP` (los navegadores exigen contexto
seguro). Dos formas de obtener HTTPS sin abrir puertos del router:

### Opción recomendada: Tailscale Serve

1. Instala **Tailscale** en el QNAP (App Center o contenedor) y en tu dispositivo.
2. Expón la web con HTTPS automático (cert `*.ts.net`):
   ```bash
   tailscale serve --bg --https=443 http://localhost:3000
   ```
3. Accede por `https://<nombre-nas>.<tu-tailnet>.ts.net` → ahí **sí** puedes
   instalar la PWA y probar el service worker.
4. Ajusta entonces `NEXT_PUBLIC_*`, `APP_PUBLIC_URL` y `CORS_ORIGIN` a esa URL
   HTTPS y reconstruye `web` (`docker compose ... up -d --build web`).

> Synapse también debería exponerse por HTTPS detrás de Tailscale Serve si el
> navegador carga la web por HTTPS (no se puede mezclar contenido HTTP). Lo más
> simple para PWA: poner web **y** Synapse tras Tailscale/HTTPS, o usar el perfil
> `proxy` (Caddy/Nginx) en un puerto alto que no choque con QTS.

### Alternativa
Cloudflare Tunnel hacia el QNAP (también da HTTPS, requiere dominio en Cloudflare).

## Limpieza

```bash
docker compose -f infra/docker-compose.yml --profile full --profile proxy down
# para borrar datos también:
docker compose -f infra/docker-compose.yml down -v
```

## Notas

- Rendimiento: el APU GX-420MC es modesto; ideal para **pruebas/demo con pocos
  usuarios**, no para producción con carga.
- Backups: si el test se vuelve permanente, respalda **ambos** Postgres (el de
  Synapse contiene los mensajes).
