# apps/api — the Express API. Build CONTEXT is the repo root (lockfile + workspace manifest live
# there). The IMAGE contains only dist/ + production dependencies.
#
#   docker build -f apps/api/Dockerfile -t vastu-api .

FROM node:22-alpine AS base
RUN npm install -g pnpm@12.16.1
WORKDIR /app

# ── deps: manifests only, so editing a .ts file doesn't invalidate the install layer ──
FROM base AS deps
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/api/package.json           apps/api/
COPY packages/config/package.json    packages/config/
COPY packages/contracts/package.json packages/contracts/
RUN pnpm install --frozen-lockfile

# ── build ──
FROM deps AS build
# packages/contracts is SOURCE-only (exports ./src/index.ts); it is bundled into dist/ by esbuild.
COPY packages/config    packages/config
COPY packages/contracts packages/contracts
COPY apps/api/tsconfig.json apps/api/.dependency-cruiser.cjs apps/api/esbuild.config.mjs apps/api/
COPY apps/api/src apps/api/src
# `build` = tsc --noEmit && esbuild, so a type error fails the image instead of shipping.
RUN pnpm --filter @vastu/api build
# Production-only, real (non-symlinked) node_modules for the runtime stage.
RUN pnpm --filter @vastu/api deploy --prod --legacy /prod/api

# ── runtime ──
FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build --chown=node:node /prod/api/node_modules ./node_modules
COPY --from=build --chown=node:node /app/apps/api/dist     ./dist
USER node
EXPOSE 4000
# Exec form so node is PID 1 and receives SIGTERM (server.ts drains in-flight requests).
CMD ["node", "dist/server.js"]
