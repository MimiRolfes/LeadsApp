# docs/data-model.md — humatter Leads

Status: Phase 1. Schema-Quelle: `apps/backend/src/db/schema/*.ts`.
Migrationen: `apps/backend/src/db/migrations/` (0000_init, 0001_audit_log_append_only).
Datum: 2026-08-31

## Überblick

PostgreSQL, normalisiert, migrations-first. UUID-Primärschlüssel werden in der
Anwendung erzeugt (`crypto.randomUUID()`), damit keine DB-Extension nötig ist —
maximale Portabilität (lokaler Docker-Postgres wie Hetzner). Zeitstempel `timestamptz`, intern
UTC. Case-insensitive Eindeutigkeit (E-Mail, Tag-Label) über funktionale
Indizes auf `lower(...)`, ebenfalls extensionsfrei.

18 Tabellen in fünf Gruppen:

| Gruppe | Tabellen |
| --- | --- |
| Identität | `users`, `sessions`, `password_reset_tokens` |
| Event | `events`, `event_members`, `questions` |
| Leads | `leads`, `lead_answers`, `lead_notes`, `tags`, `lead_tags`, `attachments` |
| Follow-up | `followups`, `followup_templates` |
| Betrieb | `lead_merges`, `exports`, `sync_receipts`, `audit_log` |

## ER-Diagramm (Text)

```
users ──< event_members >── events ──< questions
  │                           │
  │                           ├──< leads ──< lead_answers >── questions
  │                           │        ├──< lead_notes
  │                           │        ├──< lead_tags >── tags ──> events
  │                           │        ├──< attachments
  │                           │        └──< followups >── followup_templates
  │                           ├──< exports
  │                           └──< lead_merges
  ├──< sessions
  └──< password_reset_tokens

audit_log        (keine FK — bewusst entkoppelt, append-only)
sync_receipts    (Idempotenz für Offline-Sync)
```

## Mandanten-/Event-Isolation

Jede operative Zeile trägt direkt oder transitiv `event_id`. Zugriff wird
serverseitig über die zentrale AuthZ-Policy + `event_members` geprüft
(ADR 0002). Optional zusätzlich RLS (`SET LOCAL app.user_id`) —
Entscheidung beim Backend (Phase 2), Default-Empfehlung: an.

`ON DELETE`:
- Event gelöscht → alle abhängigen operativen Daten `CASCADE`.
- User gelöscht → `owner_id`/`author_id`/`assignee_id` `SET NULL`
  (Datensatz bleibt erhalten), `sessions`/`event_members` `CASCADE`.

## PII-Klassifizierung

Legende: **P1** = direkt identifizierend · **P2** = personenbeziehbar /
bewertend · **S** = Systemdaten (kein Personenbezug oder nur mittelbar).

### `users`
| Spalte | Klasse | Hinweis |
| --- | --- | --- |
| email | P1 | Login-Identität; nur `lower()` im Unique-Index |
| display_name | P1 | Mitarbeitendenname |
| password_hash | S (Geheimnis) | Argon2id (Phase 2), nie geloggt |
| totp_secret | S (Geheimnis) | optional (2FA), verschlüsselt ablegen (Phase 2) |
| global_role, status, *_at | S | |

### `sessions`, `password_reset_tokens`
Nur Hashes (`token_hash`) und gehashte Metadaten (`ip_hash`, `user_agent_hash`).
Kein Klartext. Klasse S (Geheimnis).

### `events`, `event_members`, `questions`
Klasse S. `questions.prompt` ist Konfiguration, keine PII.
Freitext-Fragen sollen nicht zu sensiblen Angaben auffordern (Art. 9 DSGVO).

### `leads` — Kern der PII
| Spalte | Klasse | Retention-relevant |
| --- | --- | --- |
| first_name, last_name | P1 | ja |
| company, position | P2 | ja |
| email, phone | P1 | ja |
| website, linkedin | P2 | ja |
| country, language, source | P2 | teilweise |
| priority, lead_score | P2 (bewertend) | ja |
| legal_basis, consent_status, consent_recorded_at | S (Compliance-Nachweis) | **nein** — getrennt vom Score, für Nachweisbarkeit aufbewahren |
| client_local_id, version, *_at | S | |

Keine besonderen Kategorien nach Art. 9 DSGVO als strukturierte Felder.

### `lead_answers`, `lead_notes`
Freitext / strukturierte Gesprächsdaten → **P2**, im Zweifel P1 (Notizen
können Namen Dritter enthalten). Retention-relevant. UX vermeidet unnötige
sensible Angaben.

### `tags`, `lead_tags`
`tags.label` = Konfiguration (S). Zuordnung `lead_tags` ist P2
(Interessensprofil einer Person).

### `attachments`
Metadaten in der DB (S). Die Datei selbst (Visitenkarten-Foto/Scan) liegt im
Objektspeicher und ist **P1** (kann weitere PII enthalten). `scan_status`
steuert die Auslieferung (nur `clean`).

### `followups`, `followup_templates`
`followups` P2 (verweist auf Lead). `note` ggf. P2. `followup_templates` S.

### `lead_merges`, `exports`
`lead_merges.snapshot` (jsonb) enthält den vollständigen Zustand des
zusammengeführten Leads → **P1**, unterliegt der Retention des Events.
`exports.field_map` S; erzeugte Exportdateien enthalten P1 (separater
Speicher, eigene Retention — `docs/retention.md`).

### `sync_receipts`
`result` (jsonb) kann Lead-IDs / Teildaten enthalten → P2. Kurze Retention
(z. B. 30 Tage), da nur Replay-Schutz.

### `audit_log`
Bewusst **minimal**: `actor_id`, `action`, `entity_type`, `entity_id`,
`event_id`, `metadata` (ohne vollständige PII — keine Namen/E-Mails/Notizen),
`ip_hash`. Append-only (Trigger, Migration 0001). Eigene, längere Retention
als operative Daten (Nachweispflichten) — im Retention-Konzept getrennt
behandelt.

## Wichtige Constraints & Indizes

- `users`: UNIQUE `lower(email)`; Index auf `status`.
- `sessions`: UNIQUE `token_hash`; Index `user_id`, `expires_at`.
- `event_members`: PK `(event_id, user_id)`.
- `leads`: UNIQUE `(event_id, client_local_id)` (Idempotenz/Offline);
  Indizes `event_id`, `owner_id`, `(event_id, priority)`; partieller Index
  `(event_id, lower(email))` für Duplikatsuche auf aktiven Leads.
- `lead_answers`: UNIQUE `(lead_id, question_id)`.
- `tags`: UNIQUE `(event_id, lower(label))`.
- `lead_tags`, `lead_tags`: PK `(lead_id, tag_id)`.
- `attachments`: UNIQUE `storage_key`.
- `sync_receipts`: PK `idempotency_key`.
- `audit_log`: Indizes `(entity_type, entity_id)`, `event_id`, `created_at`;
  BEFORE-UPDATE/DELETE-Trigger wirft `insufficient_privilege`.

## Optimistische Sperre

`leads.version` (Default 1) wird von der Anwendung bei jedem Update erhöht.
Der Sync-Endpunkt (Phase 2) nutzt `version` zur Konflikterkennung (ADR 0003).

## `updated_at`

Anwendungsseitig gepflegt (drizzle `$onUpdate`) — kein DB-Trigger, um
extensionsfrei/portabel zu bleiben.

## Änderungen am Schema

Nur über neue Migrationen (`npm run db:generate` nach Schema-Änderung, dann
Review). Bestehende Migrationen werden nicht editiert.
