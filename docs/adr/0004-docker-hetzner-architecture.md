# ADR 0004 — Containerisierte Architektur (Docker) mit Ziel Hetzner

- Status: Akzeptiert
- Datum: 2026-08-31
- Kontext: Infrastruktur-Vorgaben der Auftraggeberin (2026-08-31).
  **Ersetzt** alle früheren „Herakles"-spezifischen Festlegungen; die
  Deployment-Teile von ADR 0002 sind hierdurch überschrieben (die
  Isolations-Prinzipien in ADR 0002 gelten weiter).

## Kontext

Die Anwendung wird vollständig mit Docker entwickelt und später auf einem
bestehenden **Hetzner-Server** betrieben. Zum jetzigen Zeitpunkt: **kein
Zugriff** auf den Server, keine Kenntnis über OS, Servergröße, Firewall,
Domain, DNS, Reverse Proxy, vorhandene Docker-Installation, Backup, Monitoring
oder CI/CD. Das darf die Entwicklung nicht blockieren.

## Entscheidung

### 1. Drei getrennte Docker-Services

```
compose.yaml
├── frontend   Next.js PWA (App Router)         — Port 3000, nur via Reverse Proxy
├── backend    Hono REST-API + Drizzle          — Port 8080, nur intern
└── db         PostgreSQL 16 + persistentes Volume — Port 5432, nur intern
   (+ migrate  Einmal-Job: versionierte Migrationen vor dem Backend)
```

Frontend, Backend und DB sind sauber getrennt. Gemeinsamer, deploymentneutraler
Code liegt im Workspace-Paket `@humatter-leads/shared` (Konstanten, Logger,
später Zod-DTOs) — **ohne** DB- oder Secret-Zugriff.

### 2. Netzwerkisolation

- `backend_net` (`internal: true`): `db`, `migrate`, `backend` — kein Internet,
  kein Host-Zugang.
- `web_net`: `frontend`, `backend`.
- Die **Datenbank ist nur für `backend`/`migrate` erreichbar** — nicht für das
  Frontend, nicht vom Host, nicht aus dem Internet. `compose.yaml` vergibt für
  `db` und `backend` **keine** veröffentlichten Ports.
- Der Browser spricht ausschließlich mit dem Frontend-Origin. Next.js reicht
  `/api/*` serverseitig an `http://backend:8080` weiter (First-Party-Cookies,
  kein CORS nötig).

### 3. Datenpersistenz

- Benanntes Volume `db_data` → `/var/lib/postgresql/data`.
- `docker compose down`, Rebuilds und App-Updates führen **nicht** zu
  Datenverlust. Nur explizites `down -v` / `volume rm` / Datenträgerausfall.
- **Keine** automatischen destruktiven DB-Resets. Schema-Änderungen
  ausschließlich über versionierte SQL-Migrationen
  (`apps/backend/src/db/migrations/`), Runner `db:migrate`, idempotent.
- Ein Volume ist kein Backup → zusätzliches `pg_dump`-Backup-Konzept
  (`docs/backup-restore.md`).

### 4. Keine Infrastrukturwerte im Code

Alle deploymentabhängigen Werte (`DATABASE_URL`, DB-Name/-User/-Passwort,
`SESSION_SECRET`, `BACKEND_INTERNAL_URL`, Ports, SMTP, S3, Domains …) kommen
aus der Umgebung, validiert in `apps/backend/src/env.ts` bzw.
`apps/frontend/src/env.ts`. `.env.example` pflegt Namen + Beschreibungen;
echte Secrets nie im Repo / in Dockerfiles / in `compose.yaml` / in Doku.

### 5. Deploymentneutrale Paketierung

- Multi-Stage-Dockerfiles, gepinnte Basis-Images
  (`node:22.20.0-bookworm-slim`, `postgres:16.6-bookworm`).
- Backend → esbuild-Bundle, Runtime-Image ohne `node_modules`.
- Frontend → Next.js „standalone".
- Beide Container laufen als **non-root**, `no-new-privileges`.
- **Keine** Bindung an einen bestimmten Reverse Proxy / TLS-Anbieter. Der
  spätere Proxy muss nur `127.0.0.1:${FRONTEND_PORT}` per HTTPS veröffentlichen.

### 6. Gleiche Anwendung lokal und in Produktion

Unterschiede ausschließlich über Environment/Konfiguration — **keine**
getrennte Business-Logik für Dev/Prod. Lokale Host-Ports (db/backend) nur über
`compose.override.yaml` (in `.gitignore`, nie deployt).

### 7. Nicht real prüfbare Punkte

Alles, was ohne Server-Zugriff nicht verifizierbar ist, wird als
**`REQUIRES_PRODUCTION_VERIFICATION`** markiert (TLS, Firewall, DNS,
öffentliche Ports, Hardening, Backup-Ausführung, Restore-Test auf Prod,
Monitoring, Hosting-/Datenresidenz, Docker-/OS-Patching). Diese Punkte werden
nicht als erledigt behauptet, solange sie nicht auf der Zielinfrastruktur
geprüft wurden. Es wird nicht auf Server-Zugang gewartet und nicht danach
gefragt.

### 8. Offline-Funktion unverändert

PWA → Backend → PostgreSQL im Normalbetrieb; bei fehlendem Netz lokaler
Offline-Store + Sync-Queue; bei Rückkehr Sync-Queue → Backend → PostgreSQL
(ADR 0003). Der lokale Store ist nur temporärer Zwischenspeicher, **nicht**
die primäre Datenbank. PostgreSQL bleibt Source of Truth.

## Konsequenzen

- Monorepo (npm workspaces): `apps/frontend`, `apps/backend`,
  `packages/shared`.
- Backend ist ein eigenständiger Dienst (Hono) — API-Verträge zwischen
  Frontend und Backend müssen explizit sein (Zod-DTOs in `shared`, Phase 2).
- Tests laufen ohne Docker: DB-/Schema-Tests gegen PGlite (WASM-Postgres),
  dieselben Migrationen. Echte Container-Tests (Start, Neustart-Persistenz,
  Backend↔DB) laufen lokal mit Docker und sind Teil der QA (Phase 5).
- Doku: `docs/HETZNER_DEPLOYMENT.md` (Handover) + `DEPLOYMENT_CHECKLIST.md`.
- ADR 0002: „herakles"-Betriebsdetails sind ersetzt; Row-Scoping + zentrale
  AuthZ + optional RLS bleiben gültig.
