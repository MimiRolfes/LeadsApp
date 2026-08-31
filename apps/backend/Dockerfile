# syntax=docker/dockerfile:1
#
# humatter Leads — Backend / API (Hono + Drizzle).
# Multi-Stage: deps -> build (esbuild-Bundle) -> runner.
# Das Runtime-Image enthält nur das gebündelte dist/ + die Migrationen,
# keine node_modules, läuft als non-root.
#
# Build-Context ist die Repo-Wurzel (siehe compose.yaml), damit die
# Workspace-Pakete verfügbar sind.
#
# KEINE Secrets im Image. Alle Laufzeitwerte kommen beim Start aus der Umgebung.

ARG NODE_VERSION=22.20.0

# --- deps --------------------------------------------------------------
FROM node:${NODE_VERSION}-bookworm-slim AS deps
WORKDIR /repo
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/package.json
COPY apps/backend/package.json apps/backend/package.json
COPY apps/frontend/package.json apps/frontend/package.json
RUN npm ci

# --- build ------------------------------------------------------------
FROM node:${NODE_VERSION}-bookworm-slim AS build
WORKDIR /repo
COPY --from=deps /repo/node_modules ./node_modules
COPY . .
RUN npm run build -w @humatter-leads/backend

# --- runner ---------------------------------------------------------
FROM node:${NODE_VERSION}-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8080

RUN groupadd --system --gid 1001 nodejs \
  && useradd --system --uid 1001 --gid nodejs app

COPY --from=build --chown=app:nodejs /repo/apps/backend/dist ./dist

USER app
EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||8080)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

# Migrationen laufen als separater Compose-Service (target: build), NICHT
# automatisch beim Containerstart.
CMD ["node", "dist/server.js"]
