# chirola-api en producción. Contexto de build: la raíz del monorepo.
#
# Tres etapas que importan:
# - `runtime` es lo que corre en prod: dependencias de producción, el cliente de Prisma generado
#   y el código compilado.
# - `tools` es el workspace entero con prisma y ts-node, para migrar y correr los scripts de alta
#   (create-api-client, register-webhook). Se buildea sólo cuando se usa:
#     docker compose -f docker-compose.prod.yml --env-file .env run --rm --build api-tools pnpm prisma migrate deploy
# - `build` compila; las otras dos salen de ahí.
FROM node:22-alpine AS workspace

RUN corepack enable
WORKDIR /app

# Los package.json de todo el workspace primero para cachear el install.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/shared/package.json packages/shared/
COPY services/api/package.json services/api/

FROM workspace AS build
# --ignore-scripts: el "prepare" de @chirola/shared corre tsc y todavia no
# copiamos el codigo fuente en esta capa (solo los package.json, para cachear
# el install). Prisma generate se corre explicito mas abajo.
RUN pnpm install --frozen-lockfile --ignore-scripts

COPY packages/shared packages/shared
COPY services/api services/api
RUN pnpm --filter @chirola/shared build \
 && pnpm --filter @chirola/api prisma:generate \
 && pnpm --filter @chirola/api build
# prisma es devDependency, así que el cliente se genera acá y viaja aparte. Su carpeta dentro de
# .pnpm cambia de nombre entre esta instalación y la de producción (el sufijo de peers), por eso
# se ubica resolviendo el symlink de @prisma/client en cada etapa.
RUN cp -r "$(readlink -f services/api/node_modules/@prisma/client)/../../.prisma" /prisma-client

FROM build AS tools
ENV NODE_ENV=production
WORKDIR /app/services/api

FROM workspace AS production-dependencies
RUN pnpm install --frozen-lockfile --prod --ignore-scripts --filter "@chirola/api..."

FROM node:22-alpine AS runtime
# npm, yarn y corepack sólo sirven para instalar: sus dependencias propias (tar, pacote,
# sigstore) y el pnpm que corepack dejaba en cache eran las vulnerabilidades de la imagen.
RUN apk upgrade --no-cache \
 && rm -rf /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/corepack \
        /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack \
        /opt/yarn-* /usr/local/bin/yarn /usr/local/bin/yarnpkg
WORKDIR /app
COPY --from=production-dependencies /app ./
COPY --from=build /prisma-client /prisma-client
RUN prisma_client_dir="$(readlink -f services/api/node_modules/@prisma/client)/../../.prisma" \
 && rm -rf "$prisma_client_dir" \
 && mv /prisma-client "$prisma_client_dir"
COPY --from=build /app/packages/shared/dist packages/shared/dist
COPY --from=build /app/services/api/dist services/api/dist

ENV NODE_ENV=production
WORKDIR /app/services/api
EXPOSE 3000
CMD ["node", "dist/main.js"]
