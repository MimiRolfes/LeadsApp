# docs/plan.md — humatter Leads · Agent 1 (PLAN / ARCHITECT)

Status: Entwurf für Gate 1 (Plan-Review durch frontend / backend / database / security)
Datum: 2026-08-31
Quelle: `PROJECT.md`, `CLAUDE.md`, `MASTER_PROMPT.md`

---

## 1. Repository- / Stack-Analyse

### Ist-Zustand
- Verzeichnis `/Users/milena/Desktop/Work/Messe/LeadsApp` enthält ausschließlich:
  - `PROJECT.md`, `CLAUDE.md`, `MASTER_PROMPT.md`, `.DS_Store`
- **Kein Git-Repository**, kein `package.json`, kein vorhandener Code, keine CI, kein Deployment-Setup.
- Kein bestehender humatter-Stack im Ordner auffindbar (Auth, Backend, API-Konventionen, Shared-Components).

### Schlussfolgerung
Es handelt sich um ein **Greenfield-Projekt**. `CLAUDE.md` Regel 6/7 (bestehenden humatter-Stack bevorzugen, keine Neuarchitektur ohne Begründung) kann mangels Zugriff auf ein humatter-Repo nicht direkt erfüllt werden.

> **OQ-1 — beantwortet 2026-08-31:** Greenfield. Es gibt kein internes humatter-Repo / Auth-System / Component-Library zum Wiederverwenden. Der Stack unten ist damit verbindlich (ADR 0001 → Akzeptiert).

### Stack-Vorschlag (Details + Alternativen in `docs/adr/0001-stack-selection.md`)
| Ebene | Wahl | Begründung (kurz) |
|---|---|---|
| Sprache | TypeScript strict (end-to-end) | `MASTER_PROMPT` §0.4, `CLAUDE.md` Coding Standards |
| Frontend / PWA | Next.js (App Router) + React — eigener Service `apps/frontend` | SSR, PWA-fähig, proxyt `/api` ans Backend |
| Backend / API | **Hono** + `@hono/node-server` — eigener Service `apps/backend` | schlank, typed, container-freundlich; einziger DB-Zugriff |
| Gemeinsam | `packages/shared` (Konstanten, Logger, Phase 2: Zod-DTOs) | ein API-Vertrag, keine Duplikate |
| Validierung | Zod an jeder API-Grenze | `CLAUDE.md` API-Regeln |
| DB | PostgreSQL 16 (Docker-Service `db` + persistentes Volume) | `MASTER_PROMPT` §4 |
| DB-Zugriff | Drizzle ORM + SQL-Migrationen (migrations-first) | parametrisiert, typisiert, explizite Migrationen |
| Auth | Session-basiert (HttpOnly/Secure/SameSite Cookies), Argon2id, optional TOTP-2FA | `MASTER_PROMPT` §2A, §4 |
| AuthZ | zentrale Policy-Schicht `apps/backend/src/authz` (kein verteilter Rollen-Check) | `CLAUDE.md` Coding Standards |
| Offline | Service Worker (Workbox) + IndexedDB Outbox + Sync-Queue | `MASTER_PROMPT` §2I, `CLAUDE.md` Offline-Regeln |
| Paketierung | Docker (Multi-Stage, non-root), `compose.yaml` (3 Services + `migrate`) | ADR 0004 |
| Tests | Vitest (unit/integration; DB-Tests via PGlite), Playwright (E2E/Offline/PWA, Phase 5), axe | `MASTER_PROMPT` §5 Agent 6 |

> **OQ-2 — final 2026-08-31 (ersetzt frühere „Herakles"-Planung):**
> Vollständig **containerisiert mit Docker**. Drei getrennte Services
> (`frontend`, `backend`, `db`) + `migrate`-Job in `compose.yaml`, interne
> Docker-Netze, persistentes Volume, DB nie öffentlich. Lokal entwickelt,
> später auf einem **Hetzner-Server** (kein Zugriff, keine Annahmen). Alle
> Infra-Werte via ENV. Handover: `docs/HETZNER_DEPLOYMENT.md` +
> `DEPLOYMENT_CHECKLIST.md`. Nicht prüfbare Punkte →
> `REQUIRES_PRODUCTION_VERIFICATION`. Siehe **ADR 0004**.

---

## 2. Figma-Zugriffsstatus — **BLOCKER für Frontend (Gate 1)**

- Figma MCP ist authentifiziert als `Mimi <milena.rolfes@web.de>`, Team „milena.rolfes's team" (Pro).
- **Stand 2026-08-31: Figma-Link erhalten + Design-Richtung freigegeben.**
  - Datei `figma.com/design/aTefbNYHYn4gfUZoKa7UgW` („Humatter-Insta", Seite „Rohmaterial") ist die **Instagram-/Marketing-Asset-Datei, kein App-Design** — Logo, Markenfarben, Display-Typo, Tonalität, Illustrationsstil; **keine** App-Screens/Komponenten/Spacing-Skala.
  - **Freigabe der Auftraggeberin (2026-08-31): Es gibt kein App-Design; die App-UI wird auf Basis der Marken-Merkmale aus dieser Figma-Datei gestaltet.**
  - Marken-Rohwerte extrahiert und in [`docs/design-system.md`](design-system.md) dokumentiert; Tokens in `app/globals.css`.
  - **B-1 aufgelöst.** Offen bleibt nur die spätere Freigabe der konkret abgeleiteten UI-Richtung durch die Auftraggeberin (Review in Phase 3).
- `PROJECT.md` / `CLAUDE.md` / `MASTER_PROMPT` §3: Figma ist Source of Truth für Farben, Typografie, Spacing, Radius, Komponenten, Icons, Tonalität. **Keine Design-Tokens erfinden.**

> **BLOCKER B-1 (Figma):** Vor der Frontend-Implementierung wird der Figma-Link bzw. Zugriff auf die humatter-Design-Dateien benötigt. Bis dahin: kein `docs/design-system.md`, keine UI-Komponenten, keine Tokens.
>
> Erlaubt ohne Figma: Datenmodell, API-Verträge, DB-Schema/Migrationen, AuthN/AuthZ, Threat Model, Test-Strategie, Offline-Sync-Kern (headless), Projekt-Gerüst.

---

## 3. MVP-Scope

### In Scope (MVP)
1. **Auth & Benutzer**: Login, Session-Management, Logout auf allen Geräten, Passwort-Reset, Benutzer aktivieren/deaktivieren, Rollen Admin / Messe-Manager / Teammitglied / Read-only. 2FA (TOTP) als Feature-Flag vorbereitet, standardmäßig optional.
2. **Event-Verwaltung**: Events (Name, Ort, Start/Ende, Status `draft|active|closed`), Team-Zuweisung, Event-Dashboard-KPIs.
3. **Lead-Erfassung**: manuelle Eingabe (primär), Foto-/Scan-Upload, QR-/Barcode-Scan (Client-Dekodierung). Visitenkarten-OCR: **Schnittstelle + Confidence-UX vorgesehen, Provider-Anbindung Phase 2** (Datenschutz-Prüfung des OCR-Anbieters nötig — OQ-4).
4. **Gesprächsbericht / Qualifizierung**: Freitext-Notizen, konfigurierbarer Fragenkatalog (pro Event), Interessen-Tags, strukturierte Felder (Produktinteresse, Unternehmensgröße, Rolle im Buying Center, Use Case, Zeithorizont, gewünschter nächster Schritt), Hot/Warm/Cold, transparenter konfigurierbarer Lead-Score, Follow-up-Datum + Verantwortlicher, **Rechtsgrundlage/Einwilligungsstatus als getrenntes Feld** (nicht Teil des Scores).
5. **Lead-Liste & Detail**: Suche, Filter (Status, Owner, Event, Priorität, Follow-up, Tags), Sortierung, Pagination, Detailansicht, Änderungsverlauf (Audit), Duplikaterkennung + Merge mit Audit-Trail.
6. **Follow-up**: Aufgaben mit Fälligkeit (offen/erledigt/überfällig), Textvorlagen, „Heute nachfassen"-Ansicht. Kein automatischer E-Mail-Versand.
7. **PWA / Offline**: installierbare PWA, Offline-Lead-Capture, geschützte lokale Outbox, Sync-Queue mit Retry + Konfliktstrategie + Server-Ack, sichtbare Sync-Zustände, Bereinigung nach Sync.
8. **Reporting**: Leads gesamt / pro Nutzer / pro Tag, Hot/Warm/Cold, Follow-up-Quote, Zeit bis Follow-up, einfacher Conversion-Funnel, Anzahl Exporte.
9. **Export**: CSV + XLSX + JSON, Feldmapping, separat berechtigt, jeder Export auditiert.
10. **Betroffenenrechte / Retention (technisch)**: Lead-Export (Auskunft), Berichtigung, Löschung (hard + Anonymisierung), konfigurierbare Retention/Auto-Delete pro Event, Audit für Delete/Merge/Export/Admin.
11. **Security-Basis**: serverseitige AuthZ pro Route, RBAC + Event-Scope-Isolation, Rate Limits, Request-Size-Limits, sichere Cookies, CSP/Security-Header, restriktives CORS, sichere Uploads, strukturierte Fehler ohne Stacktraces/PII.

### Out of Scope (Phase 2 / Optional)
Kiosk-/Self-Service-Modus, NFC, Sprache-zu-Text, Visitenkarten-OCR-Produktivanbindung, echte CRM-Konnektoren (nur generische Integrationsschicht wird vorbereitet), automatisierte Follow-up-Entwürfe/E-Mail-Versand, Termin-/Raumbuchung, digitale Mediathek, frei konfigurierbare Scoring-Regel-Engine (MVP: gewichtete Felder + Schwellen), externe Badge-Provider, SSO (falls nicht durch bestehenden Stack vorgegeben — OQ-3).

### Nicht-Ziele (dauerhaft, aus `PROJECT.md`)
Kein ATS/Bewerbermanagement, keine automatisierten HR-Entscheidungen, kein Sammeln sensibler/Art.-9-Daten als strukturierte Felder, kein unkontrolliertes Scraping, kein automatischer Marketingversand ohne geklärte Rechtsgrundlage, keine Zertifizierungs-Behauptungen.

---

## 4. User Flows (High Level)

### 4.1 Kern-Flow „Lead erfassen" (mobil, einhändig, kurz)
```
Login → Aktives Event (auto, wenn genau eines) 
  → [+ Lead erfassen]
  → Erfassungsart wählen: Manuell | Scan (Kamera/QR) | Foto-Upload
  → Kontaktdaten-Formular (vorbefüllt bei Scan; Confidence-Hinweise sichtbar)
  → Prüfen/Korrigieren  → [Weiter]
  → Duplikat-Check (Server oder lokal): Treffer? → [Vorhandenen öffnen] | [Trotzdem neu] 
  → Gesprächsbericht: Fragenkatalog + Notizen + Tags + Priorität (Hot/Warm/Cold)
  → Follow-up: Datum + Owner (Default: aktueller Nutzer)
  → Rechtsgrundlage/Einwilligungsstatus setzen
  → [Speichern]  → online: Server-Ack + synced | offline: pending in Outbox
```
Zustände an jedem Schritt: `loading | empty | error | offline | sync pending | permission denied | duplicate found`.

### 4.2 Offline-Erfassung & Sync
```
Offline: Lead wird mit lokaler ID (UUID v4, client-generiert) + syncStatus=pending in IndexedDB-Outbox gespeichert.
Netz zurück / periodischer Sync / manueller "Jetzt synchronisieren":
  → Outbox sequentiell abarbeiten, idempotenter POST mit Idempotency-Key = lokale ID
  → Server-Antwort:
     201/200 → syncStatus=synced, Server-ID gemappt, lokale Kopie nach Policy bereinigt
     409 Conflict → Konfliktauflösung (siehe adr/0003): Feld-Merge / "server gewinnt bei strukturierten Feldern, union bei Tags/Notizen" + Nutzerhinweis bei echten Kollisionen
     4xx dauerhaft → syncStatus=failed, im UI sichtbar, manueller Retry/Bearbeiten
     5xx / Netzfehler → Backoff-Retry (exponentiell, begrenzt), bleibt pending
Keine stillen Datenverluste: failed-Items bleiben lokal, bis Nutzer sie löst.
```

### 4.3 Event anlegen & Team zuweisen (Messe-Manager)
```
Events → [Neues Event] → Name/Ort/Zeitraum → Fragenkatalog konfigurieren (aus Vorlage oder neu)
  → Retention-Regel wählen (z. B. Löschung/Anonymisierung X Monate nach Event-Ende)
  → Team zuweisen (Nutzer mit Rolle Teammitglied/Manager) → Status = active
```

### 4.4 Nachbereitung (Desktop-Dashboard)
```
Event-Dashboard (KPIs) → Lead-Liste (Filter/Suche/Sort/Pagination)
  → Lead-Detail: Verlauf, Merge-Vorschläge, Follow-up-Status bearbeiten
  → Export: Felder wählen → Format (CSV/XLSX/JSON) → [Export] → Audit-Eintrag + Download
```

### 4.5 Betroffenenrechte (Admin / Manager)
```
Lead-Detail → [DSGVO-Aktionen]
  → Auskunft/Export (alle Daten des Leads als JSON/PDF)
  → Berichtigung (normale Bearbeitung, auditiert)
  → Löschung: Hard-Delete | Anonymisierung (PII entfernt, aggregierte KPIs bleiben) → Audit-Eintrag
Retention-Job (Cron): pro Event-Regel automatisch anonymisieren/löschen, Ergebnis auditieren.
```

### 4.6 Auth-Nebenflows
Passwort-Reset (Token per E-Mail, kurze Gültigkeit, single-use), „Von allen Geräten abmelden" (Session-Version/-Tabelle invalidieren), Nutzer deaktivieren (Sessions sofort ungültig), optional 2FA-Einrichtung (TOTP + Recovery-Codes).

---

## 5. Architektur (Überblick; Detail in `docs/architecture.md`, ADR 0004)

- **Containerisiert, drei Docker-Services:** `frontend` (Next.js PWA) ·
  `backend` (Hono API + Drizzle, einziger DB-Zugriff) · `db` (PostgreSQL 16
  + persistentes Volume). `migrate`-Job führt versionierte Migrationen
  einmalig vor dem Backend aus. Monorepo (npm workspaces).
- **Netzisolation:** `backend_net` (`internal: true`) für db/migrate/backend;
  `web_net` für frontend/backend. DB nie öffentlich, nie für das Frontend.
- **Frontend↔Backend:** Next.js reicht `/api/*` serverseitig an
  `http://backend:8080` weiter (First-Party-Cookies, kein CORS).
- **Schichten Backend:** `routes/` (thin: authn → zod → authz → service) →
  `authz/` (zentrale Policies) → `services/` (Domain) → `db/` (Drizzle,
  Migrationen). Gemeinsame Konstanten/DTOs in `packages/shared`.
- **Persistenz:** `audit_log` append-only (Trigger + Grants). Volume `db_data`
  überlebt Container-Lebenszyklus. Keine automatischen destruktiven Resets.
- **Objektspeicher (Phase 2):** eigenes Volume oder S3-kompatibel (EU),
  Scan-Hook, MIME-Allowlist, signierte kurzlebige URLs.
- **Isolation:** jede Ressource `event_id`-gescoped; zentrale AuthZ prüft
  `event_members` + Rolle; optional RLS (`adr/0002`).
- **Offline:** Service Worker + IndexedDB Outbox, Idempotency-Keys
  serverseitig (`sync_receipts`).
- **Secrets/Config:** nur ENV (validiert in `apps/*/src/env.ts`);
  `.env.example` gepflegt; nichts im Repo / in Images / in `compose.yaml`.

---

## 6. Datenmodell (High Level; Detail folgt in `docs/data-model.md` durch database-agent)

Kern-Entitäten:
- `users` (id, email, password_hash, status, 2fa_secret?, created_at)
- `roles` / `user_roles` — oder Rollen-Enum auf Event-Ebene via `event_members`
- `sessions` (id, user_id, created_at, expires_at, revoked_at, ip_hash, ua_hash) — für „Logout überall"
- `events` (id, name, location, starts_at, ends_at, status, retention_policy, created_by)
- `event_members` (event_id, user_id, event_role) — Isolation + Team-Zuweisung
- `question_sets` / `questions` (pro Event konfigurierbar; typ: text/select/multiselect/bool/number)
- `leads` (id, event_id, owner_id, client_local_id UNIQUE, first_name, last_name, company, position, email, phone?, website?, social?, country, language, source, priority, lead_score, legal_basis, consent_status, created_at, updated_at, deleted_at?, anonymized_at?)
- `lead_answers` (lead_id, question_id, value) — strukturierte Gesprächsdaten
- `lead_notes` (id, lead_id, author_id, body, created_at)
- `lead_tags` / `tags`
- `attachments` (id, lead_id, storage_key, mime, size, scan_status, created_at)
- `followups` (id, lead_id, assignee_id, due_date, status, template_id?, created_at, completed_at?)
- `lead_merges` (id, surviving_lead_id, merged_lead_id, performed_by, payload_snapshot, created_at)
- `exports` (id, event_id, requested_by, format, field_map, row_count, created_at)
- `audit_log` (id, actor_id, action, entity_type, entity_id, event_id?, metadata_json, created_at) — append-only
- `sync_receipts` (idempotency_key, user_id, result_ref, created_at) — Idempotenz

PII-Spalten werden in `docs/data-model.md` klassifiziert. Keine Art.-9-Felder.

---

## 7. Threat-Model-Entwurf (Detail in `docs/threat-model.md`)

Kurzfassung STRIDE / OWASP-Fokus:

| Bereich | Risiko | Gegenmaßnahme (MVP) |
|---|---|---|
| AuthN | Credential Stuffing, Brute Force | Rate Limit + Lockout/Backoff, Argon2id, generische Fehlermeldungen |
| Session | Fixation, Diebstahl, fehlende Invalidierung | Rotation bei Login, HttpOnly/Secure/SameSite, Server-Session-Store, „revoke all" |
| AuthZ | IDOR/BOLA auf Leads/Events/Exports/Attachments | zentrale Policy-Schicht, Ownership+Event-Membership-Check auf jeder Route, Tests |
| AuthZ | Vertical Privilege Escalation (Rolle) | serverseitige Rollenprüfung, kein Client-Trust, kein Mass Assignment |
| Input | SQLi | ORM/parametrisiert, Zod-Allowlist |
| Input | XSS (Notizen/Tags/Freitext) | React-Default-Escaping, CSP, keine `dangerouslySetInnerHTML`, Sanitizing bei Export/HTML |
| CSRF | State-changing Requests | SameSite=Lax + CSRF-Token für unsichere Methoden bei Cookie-Auth |
| Upload | Malware, Content-Type-Spoofing, Pfad-Traversal | MIME+Magic-Byte-Allowlist, Größenlimit, Scan-Hook, zufällige Storage-Keys, kein Ausführen |
| Export | Daten-Exfiltration, unbefugter Export | separate Permission, Audit, Rate Limit, Event-Scope |
| Offline | Replay/Doppelte Writes | Idempotency-Key = client_local_id, `sync_receipts` |
| Offline | Lokale Datenreste auf geteiltem Gerät | Bereinigung nach Sync, kein Langzeit-Cache von PII, Logout leert Outbox-Anzeige/Session |
| Privacy | Übermäßige Datensammlung / Art. 9 | Feld-Minimierung, Freitext-Hinweise, keine sensiblen Strukturfelder |
| Privacy | Fehlende Löschung/Retention | Retention-Job + testbare Delete/Anonymisierung |
| Logging | PII in Logs / Stacktraces in Responses | strukturiertes Logging mit Redaction, generische API-Fehler |
| Multitenancy | Event-übergreifender Datenzugriff | `event_id`-Scoping überall, optional RLS, negative Tests |
| Dependencies | Verwundbare Packages / Secrets im Repo | Dependency-Scan, Secret-Scan, Lockfile, `.env.example` |
| Container | DB öffentlich / Frontend→DB direkt | `db` ohne Port, nur `backend_net` (`internal: true`); non-root, `no-new-privileges` |
| Container | Datenverlust bei Update/Ausfall | persistentes Volume + verschlüsseltes Off-Site-`pg_dump`-Backup; keine Auto-Resets |
| Infra | Nicht-EU-Datenresidenz | Hetzner-Standort dokumentieren; `REQUIRES_PRODUCTION_VERIFICATION` |

Kein „Security-Theater": Keine Aussage zu Zertifizierung/„100 % sicher"/„EU-zugelassen". Finale rechtliche/Sicherheits-Prüfung bleibt erforderlich.

---

## 8. Implementierungsplan (Reihenfolge & Gates)

### Phase 0 — Gerüst ✅
- [x] Monorepo (npm workspaces), TS strict, ESLint (flat) + Prettier, Vitest
- [x] `apps/frontend` (Next.js) · `apps/backend` (Hono) · `packages/shared`
- [x] CI: typecheck + lint + format + test + build + `npm audit` + Docker-Image-Build/Smoke
- [x] `docs/architecture.md`, `docs/adr/0001..0004`

### Phase 1 — Datenbank + Container-Infra ✅ (Schema + Setup; Job/RLS-Ausbau in Phase 2)
- [x] Drizzle-Schema (18 Tabellen), Migrationen 0000/0001, FK/Constraints/Indizes
- [x] `audit_log` append-only (Trigger `insufficient_privilege` bei UPDATE/DELETE)
- [x] PGlite-Tests: Migrationen, Defaults, Unique/Cascade, append-only
- [x] `docker compose` (3 Services + `migrate`-Job + Netze + `db_data`-Volume)
- [x] Multi-Stage-Dockerfiles (non-root), `.dockerignore`, `.env.example`
- [x] `docs/data-model.md`, `docs/retention.md`, `docs/backup-restore.md`
- [x] `docs/HETZNER_DEPLOYMENT.md`, `DEPLOYMENT_CHECKLIST.md`
- [x] Seed **ohne echte PII** (`apps/backend/src/db/seed-data.ts`)
- [ ] (Phase 2) least-privilege DB-Rolle + Grants als dokumentierter Deploy-Schritt
- [ ] (Phase 2) RLS-Policies + `SET LOCAL app.user_id`

### Phase 2 — Backend-Kern (backend-agent; Review database + security + qa)
- [ ] AuthN (Login/Logout/Reset/Session/„revoke all"), Rate Limits
- [ ] zentrale AuthZ-Policy-Schicht + Tests (IDOR/BOLA, Rollen)
- [ ] Events + event_members + Fragenkataloge
- [ ] Leads CRUD + Duplicate-Check + Merge (transaktional) + Audit
- [ ] Follow-ups
- [ ] Sync-Endpunkt (idempotent) + Konfliktlogik
- [ ] Upload-Pipeline (Allowlist, Größen, Scan-Hook)
- [ ] Export (CSV/XLSX/JSON) + Audit + separate Permission
- [ ] Betroffenenrechte-Endpunkte + Retention-Job
- [ ] API-Doku / OpenAPI

### Phase 3 — Frontend (frontend-agent)
- [x] `docs/design-system.md` — Marken-Tokens extrahiert (Phase 0)
- [ ] Komponenten-Inventar + Zustände auf Basis der Tokens
- [ ] PWA-Shell + Service Worker + Offline-Outbox
- [ ] Lead-Capture-Flow (mobil), alle Zustände
- [ ] Lead-Liste/Detail/Merge-UI (Desktop)
- [ ] Event-Dashboard + Reporting
- [ ] Export-UI, DSGVO-Aktionen-UI
- [ ] a11y-Smoke (axe), responsive States

### Phase 4 — Security-Review (security-agent, Gate 3) — darf Release blockieren
- [ ] `docs/threat-model.md`, `docs/security-review.md`, `docs/privacy-data-flow.md`, `docs/compliance-gaps.md`
- [ ] OWASP-Checkliste, Pen-Test-Minimum aus `CLAUDE.md`

### Phase 5 — QA & Release (qa-agent, Gate 4)
- [ ] `docs/test-plan.md`, `docs/release-check.md`
- [ ] E2E-Kernflow + Offline-Sync + Duplicate/Merge + RBAC + Negative-Security + Export/Delete/Retention + a11y
- [ ] Production Build, Backup/Restore-Test dokumentiert
- [ ] CHANGELOG, offene Compliance-/Security-Gaps

---

## 9. Definition of Done (pro Feature)
UI + Backend vollständig · Validierung an API-Grenze · serverseitige Berechtigungen · alle Fehlerzustände · Tests (unit/integration/e2e soweit sinnvoll) · Logging/Audit bewertet · Datenschutzwirkung bewertet · Doku aktualisiert · zuständiger Review-Agent hat freigegeben.

---

## 10. Offene Fragen / Blocker

| ID | Typ | Status | Beschreibung | Blockiert |
|---|---|---|---|---|
| **B-1** | Blocker | ✅ aufgelöst | Kein App-Design in Figma; UI wird aus Marken-Tokens gestaltet (Freigabe 2026-08-31). Marken-Tokens in `design-system.md` | — |
| OQ-1 | Frage | ✅ beantwortet | Bestehender humatter-Stack? → Nein, Greenfield | — (ADR 0001 akzeptiert) |
| OQ-2 | Frage | ✅ final | Deployment? → **Docker (3 Services) → Hetzner-Server**. ADR 0004; Handover `docs/HETZNER_DEPLOYMENT.md` | — |
| OQ-3 | Frage | ✅ beantwortet | Login-Methode? → eigenes Passwort-Login (E-Mail + Passwort, Session-Cookies) | — |
| OQ-9 | Frage | ⤳ ersetzt | „Herakles" verworfen → Hetzner. EU/EWR-Standort ist `REQUIRES_PRODUCTION_VERIFICATION` (Admin) | Go-Live |
| OQ-4 | Frage | offen | Visitenkarten-OCR: gewünschter Anbieter? EU-Verarbeitung / AVV? Sonst Phase 2. | Lead-Capture Scan |
| OQ-5 | Frage | offen | E-Mail-Versand (Passwort-Reset): welcher EU-Provider / SMTP? | Phase 2 Auth, Follow-up |
| OQ-6 | Frage | offen | Retention-Standardfrist nach Messe (6/12/24 Monate)? Anonymisieren vs. hart löschen? | `retention.md` |
| OQ-7 | Frage | offen | Sprache/I18n: nur Deutsch zum Start? (`CLAUDE.md`-Default: ja) | Frontend |
| OQ-8 | Frage | offen | Duplicate-Check-Kriterien + Merge-Autorität (wer darf mergen)? | Phase 2 Leads |
| OQ-10 | Frage | offen | 2FA (TOTP): optional anbieten oder für alle verpflichtend? | Phase 2 Auth |

---

## 11. Übergabe (Format aus `CLAUDE.md`)

**Done**
- Repository-/Stack-Analyse (Greenfield bestätigt)
- Figma-Zugriff geprüft → Blocker B-1 dokumentiert
- MVP-Scope, User Flows, Architektur-Überblick, High-Level-Datenmodell, Threat-Model-Entwurf, Implementierungsplan
- Artefakte angelegt: `docs/plan.md`, `docs/architecture.md`, `docs/adr/0001-0003`, `docs/threat-model.md`

**Changed**
- Neue Dateien unter `docs/`. Kein Anwendungscode.

**Decided (2026-08-31)**
- OQ-1: Greenfield → Stack laut ADR 0001
- OQ-2: **Docker, drei getrennte Services (frontend/backend/db) → Hetzner-Server** → ADR 0004 (ersetzt „Herakles")
- OQ-3: eigenes Passwort-Login (E-Mail + Passwort), kein SSO im MVP

**Assumptions**
- UI zunächst Deutsch (`CLAUDE.md`) bis OQ-7 geklärt
- EU/EWR-Datenresidenz ist verbindliches Ziel; Hetzner-Standort ist vom Admin zu wählen/dokumentieren (`REQUIRES_PRODUCTION_VERIFICATION`)
- Kein Zugriff auf den Hetzner-Server; Entwicklung/Tests vollständig lokal (Docker)

**Risks**
- Backend als eigener Service: API-Vertrag Frontend↔Backend muss sauber spezifiziert werden (Zod-DTOs, Phase 2)
- Container-Persistenz/Restore muss mit echtem Docker getestet werden (Phase 5) — in dieser Umgebung nur Schema-Tests via PGlite
- OCR-/E-Mail-Drittanbieter können Datenschutz-Aufwand erzeugen
- `REQUIRES_PRODUCTION_VERIFICATION`-Punkte (TLS/Firewall/DNS/Backups/…) bleiben bis Hetzner-Zugriff offen
- EU-Standortnachweis „herakles" fehlt noch → Go-Live-Blocker-Kandidat (OQ-9)

**Open Questions**
- B-1 (Figma-Link) und OQ-4 bis OQ-10 (siehe Abschnitt 10)

**Required Review**
- Gate 1 Plan-Review: frontend-agent, backend-agent, database-agent, security-agent
- Blocker-Check gegen `CLAUDE.md` Gate 1: Scope ✔ definiert · Figma ✖ (B-1, „Link folgt") · Datenklassifizierung ✔ (grob, Detail in data-model) · Auth/AuthZ-Strategie ✔ · Offline-Konzept ✔
- Nächster Schritt bei grünem Gate 1: Phase 0 (Repo-Gerüst) + Phase 1 (DB-Schema/Migrationen) starten — beide brauchen kein Figma.
