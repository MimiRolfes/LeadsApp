# Changelog

Alle nennenswerten Änderungen an diesem Projekt.
Format lose nach [Keep a Changelog](https://keepachangelog.com/de/1.1.0/).

## [Unreleased]

### Changed — Infrastruktur-Pivot (ADR 0004: Docker / Hetzner)

- „Herakles"-Planung verworfen. Zielarchitektur jetzt: **drei getrennte
  Docker-Services** (`frontend`, `backend`, `db`) für einen späteren
  **Hetzner-Server**.
- **Monorepo** (npm workspaces): `apps/frontend` (Next.js PWA),
  `apps/backend` (Hono API + Drizzle, einziger DB-Zugriff),
  `packages/shared` (Konstanten, Logger, später Zod-DTOs).
- Backend von Next.js-Route-Handlers auf **Hono** umgestellt; Frontend proxyt
  `/api/*` serverseitig ans Backend (First-Party-Cookies, kein CORS).
- Docs neu: `docs/HETZNER_DEPLOYMENT.md`, `DEPLOYMENT_CHECKLIST.md`,
  `docs/adr/0004-docker-hetzner-architecture.md`. `docs/deployment.md` und
  `docs/adr/0004-local-first-*` entfernt. ADR 0001/0002 überarbeitet.

### Added — Phase 1 (Datenbank + Container-Setup)

- **Drizzle-Schema**, 18 Tabellen (`apps/backend/src/db/schema/`):
  users/sessions/password_reset_tokens · events/event_members/questions ·
  leads/lead_answers/lead_notes/tags/lead_tags/attachments ·
  followups/followup_templates · lead_merges/exports/sync_receipts/audit_log.
- **Versionierte SQL-Migrationen** `0000_init`, `0001_audit_log_append_only`
  (`audit_log` per Trigger append-only — `UPDATE`/`DELETE` → `insufficient_privilege`).
- Extensionsfrei: UUIDs in der App erzeugt, Case-Insensitivität über
  `lower()`-Indizes; portabel zu jedem PostgreSQL >= 14.
- Migrations-Runner (`db:migrate`), Seed mit **fiktiven** Daten (`db:seed`).
- **PGlite**-Tests (WASM-Postgres, kein Docker): Migrationen, Defaults,
  Unique/Cascade, append-only, Seed-Invarianten.
- **`compose.yaml`**: db + migrate-Job + backend + frontend; Netze
  `backend_net` (`internal: true`) / `web_net`; persistentes Volume `db_data`;
  Healthchecks; `no-new-privileges`. `compose.override.yaml.example` für
  lokale Host-Ports.
- **Multi-Stage-Dockerfiles** (non-root): Backend = esbuild-Bundle ohne
  node_modules; Frontend = Next.js „standalone". `.dockerignore`.
- `docs/data-model.md` (PII-Klassifizierung, Isolation), `docs/retention.md`,
  `docs/backup-restore.md` (Docker-Verfahren).
- CI erweitert: Monorepo-Checks + `docker compose config` + Image-Builds +
  Backend-Smoke; `npm audit --omit=dev`.

### Added — Phase 0 (Gerüst)

- TypeScript strict, ESLint (flat) + Prettier, Vitest.
- Zentrale Zod-validierte ENV je App (`apps/*/src/env.ts`), harter Abbruch
  bei Fehlkonfiguration.
- Strukturierter Logger ohne PII (`packages/shared/src/logger.ts`).
- Security-Header: Frontend (`next.config.ts`) + Backend
  (`hono/secure-headers`).
- Health/Readiness: Backend `GET /api/health`, `/api/health/ready` (DB);
  Frontend `GET /healthz`.
- Design-Tokens aus der humatter-Marke (`apps/frontend/app/globals.css`),
  Herleitung in `docs/design-system.md`.
- `.env.example`, `.gitignore` (schützt `.env*`, `compose.override.yaml`).

### Notes

- Noch keine Auth, keine fachlichen API-Endpunkte, kein Erfassungs-Flow
  (Phase 2/3). Migrationen sind noch **nirgends** angewendet.
- `REQUIRES_PRODUCTION_VERIFICATION`: TLS, Firewall, DNS, Hardening, echte
  Backups + Restore-Test, Monitoring, Hosting-/Datenresidenz — siehe
  `docs/HETZNER_DEPLOYMENT.md`.
