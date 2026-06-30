# Whalabi API — imagen de producción (monorepo pnpm).
FROM node:20-slim AS base
ENV PNPM_HOME=/pnpm
ENV PATH="$PNPM_HOME:$PATH"
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
# openssl: requerido por los engines de Prisma. ca-certificates: TLS saliente.
# corepack prepare: deja pnpm listo en build para que el runtime no lo descargue.
RUN apt-get update \
 && apt-get install -y --no-install-recommends openssl ca-certificates \
 && rm -rf /var/lib/apt/lists/* \
 && corepack enable \
 && corepack prepare pnpm@9.1.0 --activate
WORKDIR /app

# Dependencias (cacheables)
FROM base AS deps
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/
COPY packages/matrix/package.json packages/matrix/
COPY apps/api/package.json apps/api/
RUN pnpm install --frozen-lockfile=false --filter @whalabi/api...

# Build / generación de cliente Prisma + typecheck
FROM deps AS build
COPY packages ./packages
COPY apps/api ./apps/api
RUN pnpm --filter @whalabi/api db:generate

# Runtime (la app se ejecuta con tsx; no se emite JS con tsc)
FROM base AS runtime
ENV NODE_ENV=production
COPY --from=build /app /app
WORKDIR /app/apps/api
EXPOSE 4000
# Aplica migraciones y arranca.
CMD ["sh", "-c", "pnpm prisma migrate deploy && pnpm start"]
