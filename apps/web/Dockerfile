# Whalabi Web — imagen de producción (Next.js + monorepo pnpm).
FROM node:20-slim AS base
ENV PNPM_HOME=/pnpm
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/
COPY packages/matrix/package.json packages/matrix/
COPY apps/web/package.json apps/web/
RUN pnpm install --frozen-lockfile=false --filter @whalabi/web...

FROM deps AS build
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_MATRIX_HOMESERVER_URL
ARG NEXT_PUBLIC_MATRIX_SERVER_NAME
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_MATRIX_HOMESERVER_URL=$NEXT_PUBLIC_MATRIX_HOMESERVER_URL
ENV NEXT_PUBLIC_MATRIX_SERVER_NAME=$NEXT_PUBLIC_MATRIX_SERVER_NAME
COPY packages ./packages
COPY apps/web ./apps/web
RUN pnpm --filter @whalabi/web build

FROM base AS runtime
ENV NODE_ENV=production
COPY --from=build /app /app
WORKDIR /app/apps/web
EXPOSE 3000
CMD ["pnpm", "start"]
