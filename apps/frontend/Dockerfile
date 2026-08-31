# syntax=docker/dockerfile:1
#
# humatter Leads — Frontend (Next.js PWA, App Router).
# Multi-Stage: deps -> build -> runner (Next.js "standalone").
# Läuft als non-root. Der Browser spricht nur mit diesem Service; /api/*
# wird serverseitig an das Backend im internen Netzwerk weitergereicht.
#
# Build-Context ist die Repo-Wurzel (siehe compose.yaml).
# KEINE Secrets im Image.

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
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /repo/node_modules ./node_modules
COPY . .
# Platzhalter nur für den Build; echte Werte zur Laufzeit via ENV.
ENV NODE_ENV=production
RUN npm run build -w @humatter-leads/frontend

# --- runner ---------------------------------------------------------
FROM node:${NODE_VERSION}-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN groupadd --system --gid 1001 nodejs \
  && useradd --system --uid 1001 --gid nodejs nextjs

# Next.js "standalone" (Monorepo-Layout: outputFileTracingRoot = Repo-Wurzel)
COPY --from=build --chown=nextjs:nodejs /repo/apps/frontend/.next/standalone ./
COPY --from=build --chown=nextjs:nodejs /repo/apps/frontend/.next/static ./apps/frontend/.next/static
COPY --from=build --chown=nextjs:nodejs /repo/apps/frontend/public ./apps/frontend/public

USER nextjs
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "apps/frontend/server.js"]
