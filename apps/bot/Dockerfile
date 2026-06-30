# Whalabi Bot — imagen de producción (monorepo pnpm).
FROM node:20-slim AS base
ENV PNPM_HOME=/pnpm
ENV PATH="$PNPM_HOME:$PATH"
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
# openssl: requerido por los engines de Prisma. ca-certificates: TLS saliente.
RUN apt-get update \
 && apt-get install -y --no-install-recommends openssl ca-certificates \
 && rm -rf /var/lib/apt/lists/* \
 && corepack enable \
 && corepack prepare pnpm@9.1.0 --activate
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
COPY apps/bot/package.json apps/bot/
RUN pnpm install --frozen-lockfile=false --filter @whalabi/bot...

FROM deps AS build
COPY packages ./packages
COPY apps/api/prisma ./apps/api/prisma
COPY apps/bot ./apps/bot
RUN pnpm --filter @whalabi/bot db:generate

FROM base AS runtime
ENV NODE_ENV=production
COPY --from=build /app /app
WORKDIR /app/apps/bot
# La app se ejecuta con tsx; no se emite JS con tsc.
CMD ["pnpm", "start"]
