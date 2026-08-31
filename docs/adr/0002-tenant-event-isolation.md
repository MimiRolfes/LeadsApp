# ADR 0002 — Mandanten- / Event-Isolation

- Status: Akzeptiert. Deployment-Details durch **ADR 0004 (Docker/Hetzner)** ersetzt; die Isolations-Prinzipien hier gelten weiter.
- Datum: 2026-08-31
- Kontext: `MASTER_PROMPT` §4 (IDOR/BOLA, Tenant-/Event-Isolation), `CLAUDE.md` Gate 3

## Kontext
Alle operativen Daten (Leads, Notizen, Follow-ups, Exporte, Attachments) gehören zu genau einem Event. Nutzer sehen nur Events, denen sie zugewiesen sind (`event_members`), plus rollenabhängige Sonderrechte (Admin global). Horizontaler Zugriff über Event-Grenzen und IDOR auf Einzelressourcen sind die Hauptrisiken.

Es gibt (Stand jetzt) einen einzigen Organisations-Mandanten (humatter). „Mandant" = Organisation ist daher vorerst implizit; „Event" ist die praktische Isolationsgrenze. Sollte Multi-Org nötig werden, kommt eine `organizations`-Ebene über `events` hinzu.

## Entscheidung
**Zweischichtige Isolation:**

1. **Anwendungsschicht (verbindlich, MVP):**
   - Zentrale AuthZ-Policy (`apps/backend/src/authz`), kein verteilter Rollen-Check.
   - Jede Query lädt Ressourcen **immer** mit `event_id`-Scope (`WHERE event_id = $ctxEvent AND id = $id`), nie nur per `id`.
   - `ctx` enthält `eventRolesById` aus `event_members`; Handler rufen `assert*`-Policies vor jedem Service-Aufruf.
   - Kein Mass Assignment (nur DTO-Felder aus Zod).
   - Negative Tests (qa + security): fremdes Event, fremder Lead, fremder Export, fremdes Attachment, Rolle zu niedrig.

2. **Datenbankschicht (Defense-in-Depth) — Docker-Service `db` (ADR 0004):**
   - PostgreSQL als eigener Container, allein im Netz `backend_net`
     (`internal: true`) — nur `backend`/`migrate` erreichen die DB, kein
     öffentlicher Port, kein Host-Zugriff.
   - **Verbindliche Mindestmaßnahmen:**
     - dedizierte App-DB-Rolle mit minimalen Rechten (kein `SUPERUSER`, kein
       DDL zur Laufzeit) — Grants siehe `docs/HETZNER_DEPLOYMENT.md` §? / Migrationen,
     - `audit_log` für die App-Rolle nur `INSERT` + `SELECT`; zusätzlich
       rollenunabhängiger Trigger gegen `UPDATE`/`DELETE` (Migration 0001),
     - persistentes Volume `db_data` (Daten überleben Container-Lebenszyklus),
     - `DATABASE_SSL=require`, wenn die DB doch außerhalb des Compose-Netzes liegt.
   - **RLS als zweite Schicht (empfohlen):** Policies auf allen event-bezogenen
     Tabellen; das Backend setzt pro Request-Transaktion
     `SET LOCAL app.user_id = <uuid>`, Policy joint gegen `event_members`.
     Endgültige Entscheidung beim Ausbau der Backend-DB-Schicht (Phase 2);
     Tendenz: an.
   - Backups verschlüsselt, off-site, Restore-Test — `docs/backup-restore.md`.
   - Objektspeicher für Uploads (Phase 2): eigenes Volume oder S3-kompatibel (EU).
   - **EU/EWR-Datenresidenz:** Hetzner-Standort/Rechenzentrum ist vom Admin zu
     wählen und zu dokumentieren (`REQUIRES_PRODUCTION_VERIFICATION`).

## Alternativen
| Option | Pro | Contra |
|---|---|---|
| Nur App-Schicht | einfach, testbar | ein vergessener Scope = Leak |
| Nur RLS | DB erzwingt es hart | Logik in SQL schwerer zu testen/reviewen, Portabilität |
| Schema-pro-Event | starke Isolation | Betriebs-/Migrationskomplexität, unnötig bei einem Mandanten |
| Row-Scoping + RLS via `SET LOCAL` (gewählt) | doppelte Absicherung, self-hosted machbar | etwas mehr Aufwand, Kontext-Weitergabe an DB pro Transaktion nötig |

## Konsequenzen
- AuthZ-Policy-Schicht + Test-Suite für Isolation ist Pflicht vor Gate 2.
- Endgültige RLS-Entscheidung (an/aus) fixiert der database-agent beim Schema-Ausbau; Default-Empfehlung: an.
- Docker-Betrieb: Netzisolation der DB, non-root-Container, persistentes Volume + echtes Backup — Details in ADR 0004 / `docs/HETZNER_DEPLOYMENT.md`.
- Attachment-Zugriff nur über signierte, kurzlebige URLs nach Policy-Check — keine rate-baren Storage-Keys.
- Für spätere Multi-Org: `organizations` + `org_id` auf `events`; Policies erweitern, nicht neu schreiben.
