# humatter Leads

Interne, mobile-first **Lead-Capture- und Lead-Management-App für Messeauftritte**
von humatter. Schnelle Erfassung am Stand (PWA, offline-fähig) + zentrales
Desktop-Dashboard für Qualifizierung, Follow-up und Export.

**Repository:** <https://github.com/MimiRolfes/LeadsApp>

```bash
git clone https://github.com/MimiRolfes/LeadsApp.git
cd LeadsApp
```

> Kein Security-/Compliance-Theater: security- und privacy-by-design entwickelt.
> **Nicht** „zertifiziert" oder „EU-zugelassen". Finale rechtliche und
> sicherheitstechnische Prüfung sowie organisatorische Maßnahmen bleiben
> erforderlich.

## Status

**Phase 1 — Datenbank & Container-Setup.** Auth, API-Endpunkte und der
Erfassungs-Flow folgen. Fahrplan: `docs/plan.md` (lokal).

| Phase | Inhalt | Status |
| --- | --- | --- |
| 0 | Monorepo-Gerüst, Toolchain, CI | ✅ |
| 1 | DB-Schema, Migrationen, Docker-Setup, Retention-Konzept | ✅ (Schema + Infra) |
| 2 | Backend: Auth, AuthZ, Leads, Sync, Export | offen |
| 3 | Frontend: PWA, Capture-Flow, Dashboard | offen |
| 4 | Security-Review | offen |
| 5 | QA + Release (inkl. Container-/Persistenz-Tests) | offen |

## Architektur

Drei getrennte Docker-Services (ADR 0004, siehe `docs/adr/` lokal):

```
Browser → HTTPS → [Reverse Proxy] → frontend (Next.js PWA)
                                       └─ proxyt /api/* → backend (Hono API)
                                                             └─ backend_net (internal)
                                                                  └─ db (PostgreSQL 16 + Volume)
```

Monorepo (npm workspaces): `apps/frontend`, `apps/backend`, `packages/shared`.
Stack: TypeScript strict · Next.js (App Router) · Hono · PostgreSQL · Drizzle
(versionierte SQL-Migrationen) · Zod · Vitest.

## Schnellstart — ohne Docker, ohne Postgres

```bash
npm install
npm run dev          # backend :8080 (eingebettete DB) + frontend :3000
```

Dann <http://localhost:3000> öffnen, Konto anlegen (`@mindsewn.de`), loslegen.

`npm run dev` setzt `DB_DRIVER=pglite`: das Backend nutzt eine eingebettete
Datei-Datenbank (`apps/backend/.data/pglite/`, bleibt zwischen Neustarts
erhalten), migriert automatisch. **Nur für Entwicklung** — Produktion nutzt
immer echtes PostgreSQL.

Optional fiktive Beispieldaten: `npm run db:seed:dev`.

## Schnellstart mit Docker (produktionsnah)

```bash
cp .env.example .env          # Werte anpassen (mind. POSTGRES_*, SESSION_SECRET)
docker compose up --build     # db → migrate → backend → frontend
# Frontend:  http://localhost:3000
```

`db` und `backend` haben bewusst **keine** veröffentlichten Ports. Daten liegen
im persistenten Volume `db_data` und überleben `docker compose down` / Rebuild.
Seed: `docker compose run --rm migrate npm run db:seed -w @humatter-leads/backend`.

## Entwicklung gegen echtes Postgres (statt PGlite)

```bash
cp compose.override.yaml.example compose.override.yaml   # öffnet db-Port lokal
docker compose up -d db
# in .env: DB_DRIVER=postgres, DATABASE_URL auf localhost, dann:
npm run db:migrate && npm run db:seed
npm run dev:backend -w @humatter-leads/backend  # bzw. dev:postgres
```

### Nützliche Scripts (Repo-Wurzel)

| Script | Zweck |
| --- | --- |
| `npm run dev` | backend + frontend parallel |
| `npm run build` | beide Apps bauen (esbuild-Bundle + Next standalone) |
| `npm run check` | typecheck + lint + format:check + test (= CI) |
| `npm run test` | Vitest (shared + backend, DB-Tests via PGlite) |
| `npm run db:generate` | neue Migration aus Schema-Änderung |
| `npm run db:migrate` / `db:seed` | Migrationen / fiktiver Seed |

## Deployment

Ziel: bestehender **Hetzner-Server**, containerisiert. Auf dem Server:

```bash
git clone https://github.com/MimiRolfes/LeadsApp.git /opt/humatter-leads
cd /opt/humatter-leads
cp .env.example .env   # echte Produktionswerte eintragen, dann: chmod 600 .env
docker compose build && docker compose up -d
```

Details (lokal, nicht im Repo): `docs/HETZNER_DEPLOYMENT.md` (Handover, 17 Punkte),
`DEPLOYMENT_CHECKLIST.md` (Schritt für Schritt), `docs/backup-restore.md`.

## Konten & Anmeldung

Keine zentrale Benutzerverwaltung: Mitarbeitende legen ihr Konto selbst an.

- `POST /api/auth/register` — E-Mail (**nur `@mindsewn.de`**) + Passwort (min. 12 Zeichen)
- `POST /api/auth/login` · `POST /api/auth/logout` · `POST /api/auth/logout-all` · `GET /api/auth/me`

Konfigurierbar über `ALLOWED_EMAIL_DOMAINS` (Default `mindsewn.de`) und
`ADMIN_EMAILS`. Session als HttpOnly-Cookie.

## Dokumentation

Die ausführliche Doku liegt lokal unter `docs/` (Plan, Architektur, ADRs,
Datenmodell, Threat-Model, Retention, Backup/Restore, Deployment-Handover)
und in `CHANGELOG.md` — bewusst **nicht** im Repository.
