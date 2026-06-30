# Despliegue en Oracle Cloud (OCI) — Always Free

Guía para correr Whalabi en una instancia **Always Free** de Oracle Cloud
(**Ampere A1, ARM**). Cubre las dos trampas clásicas de OCI: **arquitectura ARM**
y el **doble firewall**.

> Las imágenes de Whalabi son **multi-arch**, así que corren en ARM **sin cambios**
> (`matrixdotorg/synapse`, `postgres`, `node`).

## 1. Crear la instancia

1. Consola OCI → **Compute → Instances → Create**.
2. **Image:** Canonical **Ubuntu 24.04**.
3. **Shape:** **Ampere A1 (ARM)** — Always Free. Recomendado **2–4 OCPU / 12–24 GB**.
4. Sube tu **clave SSH pública**.
5. Crea. Anota la **IP pública**.

> Si sale **"Out of capacity"** (típico en free tier ARM): cambia la cuenta a
> **Pay As You Go** (sigues sin pagar dentro del free tier) y/o prueba otra
> Availability Domain. Mejora mucho la disponibilidad.

## 2. ⚠️ El doble firewall (la trampa #1 de OCI)

En OCI hay que abrir puertos en **DOS** capas o el tráfico no entra:

### Capa A — Security List / NSG (firewall de la nube)

Consola → tu VCN → **Security Lists** → **Add Ingress Rules**. Añade, con
Source `0.0.0.0/0`, TCP a los puertos:

- **80** y **443** (web + Caddy/HTTPS)
- **8448** *solo si vas a federar* Matrix

(El **22** ya viene abierto para SSH.)

### Capa B — iptables dentro de la instancia (Ubuntu en OCI)

Las imágenes Ubuntu de OCI traen un `iptables` restrictivo que descarta casi todo
salvo SSH. Abre 80/443 **antes** de la regla REJECT y persiste:

```bash
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 80  -j ACCEPT
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 443 -j ACCEPT
sudo netfilter-persistent save
# verifica el orden (las ACCEPT deben ir antes del REJECT final):
sudo iptables -L INPUT --line-numbers
```

> Si tu imagen usa `ufw`, equivalente: `sudo ufw allow 80,443/tcp`.

## 3. Instalar Docker

```bash
sudo apt-get update && sudo apt-get install -y ca-certificates curl git
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER && newgrp docker   # usar docker sin sudo
docker version && docker compose version
```

## 4. Dominio + HTTPS

Para HTTPS automático con Caddy necesitas un dominio que resuelva a la IP pública:

- Un dominio propio (`chat.tu-org.com` → A record a la IP), **o**
- Un dinámico gratuito (DuckDNS, etc.).

Sin dominio puedes probar por `http://IP:3000` (directo, sin proxy), pero **la PWA
no se instala sobre HTTP** (los navegadores exigen contexto seguro).

## 5. Desplegar Whalabi

```bash
git clone https://github.com/Alianza-Indigo/Chatter.git whalabi && cd whalabi
cp .env.example .env

DOMAIN=chat.tu-org.com   # tu dominio

# --- Secretos (genera valores fuertes) ---
sed -i "s#^WHALABI_DOMAIN=.*#WHALABI_DOMAIN=$DOMAIN#"                                   .env
sed -i "s#^APP_PUBLIC_URL=.*#APP_PUBLIC_URL=https://$DOMAIN#"                           .env
sed -i "s#^CORS_ORIGIN=.*#CORS_ORIGIN=https://$DOMAIN#"                                 .env
sed -i "s#^NEXT_PUBLIC_API_URL=.*#NEXT_PUBLIC_API_URL=https://$DOMAIN#"                 .env
sed -i "s#^NEXT_PUBLIC_MATRIX_HOMESERVER_URL=.*#NEXT_PUBLIC_MATRIX_HOMESERVER_URL=https://$DOMAIN#" .env
sed -i "s#^MATRIX_DEFAULT_SERVER_NAME=.*#MATRIX_DEFAULT_SERVER_NAME=$DOMAIN#"           .env
sed -i "s#^NEXT_PUBLIC_MATRIX_SERVER_NAME=.*#NEXT_PUBLIC_MATRIX_SERVER_NAME=$DOMAIN#"   .env
sed -i "s#^ADMIN_API_TOKEN=.*#ADMIN_API_TOKEN=$(openssl rand -hex 24)#"                .env
sed -i "s#^ADMIN_JWT_SECRET=.*#ADMIN_JWT_SECRET=$(openssl rand -base64 48)#"           .env
sed -i "s#^APP_ENCRYPTION_KEY=.*#APP_ENCRYPTION_KEY=$(openssl rand -base64 48)#"        .env
sed -i "s#^BOT_PASSWORD=.*#BOT_PASSWORD=$(openssl rand -hex 16)#"                       .env

# (Opcional) Web Push: genera claves VAPID y ponlas en VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY
docker run --rm node:20-alpine npx -y web-push generate-vapid-keys

# --- Synapse: generar config con el server_name = tu dominio ---
./infra/scripts/init-synapse.sh
docker compose -f infra/docker-compose.yml up -d postgres-synapse postgres-app synapse

# --- Usuarios Matrix de prueba (el bot usa BOT_PASSWORD del .env) ---
BOT_PASS=$(grep '^BOT_PASSWORD=' .env | cut -d= -f2)
./infra/scripts/create-admin-user.sh admin "$(openssl rand -hex 12)"
./infra/scripts/create-admin-user.sh whalabi-bot "$BOT_PASS"
./infra/scripts/create-admin-user.sh cesar S3cret!

# --- Apps + Caddy (HTTPS automático) ---
docker compose -f infra/docker-compose.yml --profile full --profile caddy up -d --build
```

Abre `https://chat.tu-org.com` → login con `cesar` / `S3cret!`.

> El `MATRIX_DEFAULT_SERVER_NAME` queda como tu dominio, así los MXID son
> `@cesar:chat.tu-org.com`. Caddy enruta `/_matrix` a Synapse en el mismo dominio.

## 6. Comprobar

```bash
docker compose -f infra/docker-compose.yml ps
curl -fsS https://$DOMAIN/api/health        # { status: ok }
curl -fsS https://$DOMAIN/_matrix/client/versions   # responde Synapse
```

Sigue `docs/testing-checklist.md` para el resto.

## Notas

- **RAM:** con 12–24 GB ARM vas sobrado; el consumo de pruebas es ~3–4 GB.
- **Rendimiento ARM Ampere:** muy bueno; mejor que el APU de un NAS.
- **Backups:** snapshot del Block Volume + dumps de **ambos** Postgres si el test
  se vuelve permanente (el de Synapse tiene los mensajes).
- **Federación:** si abres 8448 (capa A y B), revisa `federation_domain_whitelist`
  en la plantilla de Synapse (`docs/matrix.md`).
