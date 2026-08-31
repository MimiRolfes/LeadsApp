# docs/architecture.md — humatter Leads

Status: Phase 1. Ergänzt `docs/plan.md`.
Datum: 2026-08-31 (Abschnitte 1–3, 15, 17, 19 aktualisiert nach ADR 0004: Docker/Hetzner)

---

## 1. Kontext & Ziele
Mobile-first PWA zur Messe-Lead-Erfassung + zentrales Desktop-Dashboard. Harte Randbedingungen: serverseitige AuthZ, Event-/Mandanten-Isolation, Offline ohne Datenverlust, EU/EWR-Datenresidenz, Privacy-by-Design, keine Secrets/PII im Repo/Log.

**Betriebsmodell (ADR 0004):** vollständig containerisiert mit Docker. Drei
getrennte Services (`frontend`, `backend`, `db`) in einem Compose-Projekt,
lokal entwickelt und getestet, später auf einem Hetzner-Server betrieben.
Keine Annahmen über die Hetzner-Konfiguration (OS, Firewall, Domain, DNS,
Reverse Proxy, Docker-Installation, Backup, Monitoring, CI/CD).
Nicht real prüfbare Punkte → `REQUIRES_PRODUCTION_VERIFICATION` in
`docs/HETZNER_DEPLOYMENT.md`.

## 2. Systemüberblick

```
  Browser / PWA
   │  HTTPS
   ▼
 [Reverse Proxy: TLS, Security-Header]        (frei wählbar, nicht Teil des Repos)
   │  → 127.0.0.1:${FRONTEND_PORT}
   ▼
 ┌────────────────────────┐   web_net    ┌──────────────────────────────┐
 │ frontend  (Next.js PWA)│─────────────▶│ backend  (Hono API + Drizzle)│
 │ - App Router, RSC      │  /api/* proxy│ - AuthN / AuthZ (Phase 2)    │
 │ - Service Worker/Outbox│              │ - Zod an der API-Grenze      │
 │ - QR/Barcode im Client │              │ - Domain-Services            │
 └────────────────────────┘              └──────────────┬───────────────┘
                                        backend_net (internal: true)
                                                        ▼
                                         ┌────────────────────────────┐
                                         │ db  (PostgreSQL 16)        │
                                         │ + persistentes Volume      │
                                         │ operative Tab. · audit_log │
                                         │ · sync_receipts            │
                                         └────────────────────────────┘
   (migrate-Job: versionierte Migrationen, läuft einmalig vor dem backend)
   Objektspeicher (Uploads, Phase 2): local-Volume ODER S3-kompatibel (EU)
```

- Der Browser spricht **nur** mit dem Frontend-Origin. Next.js reicht `/api/*`
  serverseitig an `http://backend:8080` weiter → First-Party-Cookies, kein CORS.
- `db` liegt allein im `backend_net` (`internal: true`) → nur `backend` und
  `migrate` erreichen sie; nicht das Frontend, nicht der Host, nicht das Internet.
- Schema-/DB-Tests laufen gegen PGlite (WASM-Postgres) mit denselben
  Migrationen — kein Docker in CI nötig.

## 3. Monorepo-Struktur (npm workspaces)

```
/
├─ compose.yaml                       # 3 Services + migrate-Job + Netze/Volume
├─ compose.override.yaml.example      # lokale Host-Ports (nie deployt)
├─ .env.example                       # alle ENV-Namen + Beschreibungen
├─ packages/
│  └─ shared/          @humatter-leads/shared — Konstanten, Logger, (Phase 2) Zod-DTOs
│     └─ src/          constants.ts · logger.ts · index.ts   (keine DB, keine Secrets)
├─ apps/
│  ├─ backend/         @humatter-leads/backend — Hono + Drizzle, EINZIGER DB-Zugriff
│  │  ├─ Dockerfile    deps → build (esbuild-Bundle) → runner (non-root, kein node_modules)
│  │  ├─ drizzle.config.ts
│  │  ├─ build.mjs
│  │  └─ src/
│  │     ├─ server.ts          # Entry (@hono/node-server)
│  │     ├─ app.ts             # Hono-App (Routen, Fehler, secure-headers)
│  │     ├─ env.ts             # validierte Backend-ENV
│  │     ├─ routes/            # health.ts (Phase 2: auth, events, leads, sync, export …)
│  │     ├─ authn/  authz/     # Phase 2 — Session, zentrale Policies
│  │     ├─ services/          # Phase 2 — Domain-Logik
│  │     └─ db/
│  │        ├─ schema/*.ts     # Drizzle-Schema (18 Tabellen)
│  │        ├─ migrations/     # versionierte SQL (0000_init, 0001_audit_log_append_only)
│  │        ├─ client.ts       # Verbindung aus ENV, lazy
│  │        ├─ migrate.ts seed.ts seed-data.ts
│  │        └─ testing/pglite.ts
│  └─ frontend/        @humatter-leads/frontend — Next.js PWA
│     ├─ Dockerfile    deps → build → runner (Next.js "standalone", non-root)
│     ├─ next.config.ts        # rewrites /api/* → BACKEND_INTERNAL_URL, standalone, headers
│     ├─ src/env.ts
│     └─ app/                  # App Router: layout, page, healthz, manifest, globals.css
│        (Phase 3: (capture)/ mobiler Flow · (dashboard)/ Desktop)
├─ tests/                              # (Phase 5: Playwright E2E + Container-Tests)
└─ docs/
```

**Regel Backend-Routen:** keine Domain-Logik im Handler. Reihenfolge:
`authn → zod parse → authz → service → typed response`. Keine stillen Catches;
strukturierte Fehler (`{ error: { code } }`, kein Stacktrace/SQL/Secret).

## 4. AuthN
- Passwort-Login (Argon2id), Session-Token (opaque, zufällig, 256 bit) in HttpOnly/Secure/SameSite=Lax-Cookie.
- Server-seitiger Session-Store (`sessions`-Tabelle): erlaubt „Von allen Geräten abmelden" (alle Sessions des Nutzers `revoked_at` setzen) und sofortige Invalidierung bei Nutzer-Deaktivierung.
- Session-Rotation bei Login; Idle- + Absolut-Timeout.
- Passwort-Reset: single-use Token, kurze TTL, Hash in DB, generische Antworten.
- 2FA (TOTP) hinter Feature-Flag; Recovery-Codes gehasht.
- Rate Limiting auf `/api/auth/*` (IP + Account), Backoff statt hartem permanentem Lockout.
- **OQ-3 entschieden:** eigenes Passwort-Login (E-Mail + Passwort), kein SSO im MVP. 2FA-Pflicht ja/nein noch offen (OQ-10).

## 5. AuthZ — zentrale Policy-Schicht
- Keine verteilten `if (role === ...)`-Checks in Handlern/Services.
- `apps/backend/src/authz` exportiert Funktionen wie:
  - `assertCanViewEvent(ctx, eventId)`
  - `assertCanCaptureLead(ctx, eventId)`
  - `assertCanEditLead(ctx, lead)` (Owner ODER Manager/Admin des Events)
  - `assertCanMergeLeads(ctx, event)`
  - `assertCanExport(ctx, eventId)` (separate Permission)
  - `assertCanRunDsgvoAction(ctx, lead)`
- Kontext `ctx` = `{ userId, sessionId, globalRole, eventRolesById }`. Event-Rollen aus `event_members`.
- Jede Ressource wird **immer** über `event_id` gescoped geladen; nie „by id" ohne Scope.
- Optional zusätzlich Postgres RLS als Defense-in-Depth (siehe `adr/0002`).
- Mass Assignment verhindert: Services akzeptieren nur explizite DTO-Felder aus Zod-Schema, nie `req.body` roh.

## 6. Datenfluss „Lead speichern" (online)
```
POST /api/events/:eventId/leads
 → authn: Session gültig?
 → zod: LeadCreateInput (Allowlist, Längenlimits, Enum-Checks)
 → authz: assertCanCaptureLead(ctx, eventId)
 → service.leads.create():
     - Transaktion:
       - Duplicate-Check (siehe §9)
       - insert leads (client_local_id UNIQUE pro event)
       - insert lead_answers / notes / tags
       - insert audit_log (action=lead.create)
       - insert sync_receipt (idempotency_key = client_local_id)
     - commit
 → 201 { id, serverUpdatedAt }
```
Bei erneutem Aufruf mit gleicher `client_local_id`: `sync_receipts` trifft → 200 mit vorhandener Ressource (idempotent, kein Duplikat).

## 7. Offline & Sync (Detail in `adr/0003`)
- **Outbox-Eintrag:** `{ localId (uuid), type, payload, syncStatus, attempts, lastError, baseVersion }`.
- **Sichtbare Zustände (UI):** `offline | pending | syncing | failed | synced`.
- **Trigger:** `online`-Event, Background Sync API (falls verfügbar), periodisches Polling, manueller Button.
- **Verarbeitung:** sequentiell pro Outbox, `POST` mit Header `Idempotency-Key: <localId>`.
- **Konflikt (409):** Server liefert aktuelle Version + Feldstatus. Strategie:
  - strukturierte Felder (Priorität, Score, Kontaktfelder): „last-writer-wins" mit Warnhinweis, wenn beide Seiten seit `baseVersion` geändert wurden
  - additive Felder (Tags, Notizen): Union / Append
  - echte inhaltliche Kollision → `failed`, UI zeigt Diff, Nutzer entscheidet
- **Nach Sync:** lokale PII-Payloads gemäß Sicherheitskonzept löschen; nur ID-Mapping + Status behalten.
- **Kein stiller Verlust:** `failed`-Items bleiben lokal bis Nutzeraktion.

## 8. Uploads
- Client → `POST /api/uploads/sign` (authz) → kurzlebige signierte PUT-URL, zufälliger Key.
- Nach Upload: `scan_status=pending`; Scan-Hook (AV) setzt `clean|infected`. `infected` → gesperrt, Audit.
- Allowlist: `image/jpeg`, `image/png`, `image/webp`, `application/pdf`; Magic-Byte-Prüfung; Größenlimit (z. B. 10 MB); kein serverseitiges Rendern/Ausführen.

## 9. Duplicate-Check & Merge
- Check-Kriterien (Vorschlag, OQ-8): exakte geschäftliche E-Mail (normalisiert) = starker Treffer; `last_name` + `company` (normalisiert, trigram) = schwacher Treffer.
- UI zeigt Kandidaten vor dem Speichern (`duplicate found`-State).
- Merge: transaktional, `surviving_lead_id` behält Kern, Notizen/Tags/Follow-ups werden umgehängt, `lead_merges` speichert Snapshot, Audit-Eintrag. Nur Manager/Admin (OQ-8).

## 10. Export
- `POST /api/events/:eventId/exports` → authz `assertCanExport` → Job erstellt `exports`-Zeile + Audit → Datei generiert (CSV/XLSX/JSON) → Download über kurzlebige URL.
- Feldmapping als Teil des Requests (Allowlist der exportierbaren Felder).
- Rate Limit; große Exporte asynchron via Worker.

## 11. Betroffenenrechte & Retention
- `GET /api/leads/:id/export` (Auskunft, alle verknüpften Daten als JSON).
- `POST /api/leads/:id/delete` mit `mode = hard | anonymize`.
- Retention-Job (Cron): pro `events.retention_policy` nach `ends_at + frist` automatisch `anonymize` oder `hard delete`, jede Aktion in `audit_log`.
- `docs/retention.md` (database-agent) dokumentiert Fristen, Trigger, Testbarkeit.

## 12. Audit-Log
- Eigene Tabelle `audit_log`, aus App-DB-Rolle nur `INSERT` + `SELECT` (kein `UPDATE`/`DELETE`).
- Pflichtereignisse: login/logout/reset, user aktivieren/deaktivieren, event create/update, lead create/update/delete/merge, export, dsgvo-action, retention-job.
- Inhalt: `actor_id, action, entity_type, entity_id, event_id?, metadata (minimal, keine vollständige PII), created_at`.

## 13. Logging & Fehlerbehandlung
- Strukturiertes JSON-Log: `level, ts, request_id, route, user_id?, event_id?, outcome`. **Keine** E-Mails/Namen/Notizen/Tokens im Log.
- API-Fehler: stabiler `code` + kurze Message, HTTP-Status korrekt, nie Stacktrace/SQL/Secrets.
- 4xx = Client-Fehler (validierung/authz), 5xx = unerwartet (mit request_id für Support).

## 14. Security-Header / Transport
- HTTPS erzwungen (Reverse Proxy), HSTS bereits von der App gesendet.
- Frontend: Security-Header in `apps/frontend/next.config.ts`. Backend:
  `hono/secure-headers` in `apps/backend/src/app.ts`.
- CSP: `default-src 'self'`, kein `unsafe-inline` für Scripts (Nonce/Hash),
  `img-src 'self' blob: <storage-host>`, `connect-src 'self'` — wird in Phase 3
  mit Design-System/Storage-Host verschärft.
- CORS: bei der Standard-Topologie (Frontend proxyt `/api`) **nicht nötig** —
  alles ist same-origin. `CORS_ALLOWED_ORIGINS` nur für direkten
  Browser→Backend-Zugriff.
- CSRF-Token (Double-Submit) für unsichere Methoden bei Cookie-Auth (Phase 2).

## 15. Konfiguration & Secrets
- Kein Infrastruktur-/Server-/DB-Wert im Code. Alles Deployment-Abhängige via
  ENV, validiert in `apps/backend/src/env.ts` bzw. `apps/frontend/src/env.ts`
  (harter Abbruch bei Fehlkonfiguration).
- `.env.example` pflegt Namen + Beschreibungen; echte Secrets nie im Repo, in
  Dockerfiles, `compose.yaml` oder Doku.
- Auf dem Server: `.env` mit `chmod 600` oder Secret-Store.
- `SESSION_SECRET` / DB-Passwort für Produktion neu erzeugen (≠ Entwicklung).

## 16. Build, Test, CI
- CI-Pipeline-Gates (`CLAUDE.md` Gate 2): `typecheck` + `lint` + `format:check` + `unit/integration` + `build` + `npm audit` müssen grün sein.
- Schema-/DB-Tests laufen gegen PGlite (eingebettetes Postgres, WASM) — kein Docker in CI nötig, dieselben Migrationen.
- E2E (Playwright) inkl. Offline-Simulation und PWA-Install-Smoke in separatem Job (Phase 5).
- Dependency-Scan (`npm audit`) im CI; Secret-Scan ergänzen.

## 17. Paketierung & Deployment (Docker)

Details: **`docs/HETZNER_DEPLOYMENT.md`** + **`DEPLOYMENT_CHECKLIST.md`** + **ADR 0004**.

- **Ein Kommando lokal:** `docker compose up --build` → `db` → `migrate`
  (einmalig) → `backend` → `frontend`. Erreichbar nur `127.0.0.1:${FRONTEND_PORT}`.
- **Persistenz:** benanntes Volume `db_data`. `down`/Rebuild/Update →
  **kein** Datenverlust. Keine automatischen destruktiven Resets.
- **Migrationen:** versioniert (`apps/backend/src/db/migrations/`), Runner
  `db:migrate`, idempotent, als `migrate`-Service vor dem Backend.
- **Images:** Multi-Stage, gepinnt (`node:22.20.0-bookworm-slim`,
  `postgres:16.6-bookworm`). Backend = esbuild-Bundle ohne node_modules;
  Frontend = Next.js „standalone". Beide **non-root**, `no-new-privileges`,
  mit `HEALTHCHECK`.
- **Netzisolation:** `backend_net` (`internal: true`) für db/migrate/backend;
  `web_net` für frontend/backend. DB nie öffentlich.
- **Reverse Proxy:** frei wählbar (nicht im Repo). Muss nur
  `127.0.0.1:${FRONTEND_PORT}` per HTTPS veröffentlichen.
- Nicht real prüfbare Punkte → `REQUIRES_PRODUCTION_VERIFICATION`
  (`docs/HETZNER_DEPLOYMENT.md`).

## 18. Nicht entschieden / bewusst offen
- RLS ja/nein als zusätzliche DB-Schicht → beim Backend (Phase 2) fixieren (`adr/0002`, Tendenz: an)
- Retention-/Cleanup-Job-Runner (eigener Compose-Service mit Timer vs. In-Process-Scheduler)
- OCR-Provider (OQ-4), E-Mail-Versand/SMTP (OQ-5)
- 2FA-Pflicht (OQ-10), Retention-Fristen (OQ-6), Duplicate-/Merge-Regeln (OQ-8), I18n-Umfang (OQ-7)
- API-Vertrag Frontend↔Backend: Zod-DTOs in `packages/shared` (Phase 2)

## 19. Entschieden (Stand 2026-08-31)
- Greenfield, Stack laut `adr/0001`; **Backend ausgegliedert als Hono-Service** (ADR 0004), Frontend Next.js PWA, gemeinsames `@humatter-leads/shared`.
- Containerisiert mit Docker; Ziel Hetzner, ohne Annahmen — Handover in `docs/HETZNER_DEPLOYMENT.md` + `DEPLOYMENT_CHECKLIST.md`.
- Auth: eigenes Passwort-Login, kein SSO im MVP.
- Isolation: zentrale AuthZ-Policy + `event_id`-Scoping (`adr/0002`); zusätzlich Docker-Netzisolation der DB.
- DB-Schema Phase 1 steht: 18 Tabellen, 2 Migrationen, `audit_log` append-only (Trigger), extensionsfrei, persistentes Volume.
