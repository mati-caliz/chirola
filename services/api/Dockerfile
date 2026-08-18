# chirola-api en producción. Contexto de build: la raíz del monorepo.
FROM node:22-alpine

RUN corepack enable
WORKDIR /app

# Los package.json de todo el workspace primero para cachear el install.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/shared/package.json packages/shared/
COPY services/api/package.json services/api/
# --ignore-scripts: el "prepare" de @chirola/shared corre tsc y todavia no
# copiamos el codigo fuente en esta capa (solo los package.json, para cachear
# el install). Prisma generate se corre explicito mas abajo.
RUN pnpm install --frozen-lockfile --ignore-scripts

COPY packages/shared packages/shared
COPY services/api services/api
RUN pnpm --filter @chirola/shared build \
 && pnpm --filter @chirola/api prisma:generate \
 && pnpm --filter @chirola/api build

ENV NODE_ENV=production
WORKDIR /app/services/api
EXPOSE 3000
CMD ["node", "dist/main.js"]
