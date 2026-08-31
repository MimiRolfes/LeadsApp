# docs/retention.md — humatter Leads

Status: Phase 1 (Konzept + Schema-Haken). Implementierung des Retention-Jobs
in Phase 2 (backend-agent). Rechtliche Fristbestätigung: **offen (OQ-6)**.
Datum: 2026-08-31

> Kein Compliance-Theater: Dieses Dokument beschreibt die technische
> Umsetzbarkeit. Die konkreten Aufbewahrungsfristen und Rechtsgrundlagen sind
> organisatorisch/rechtlich zu bestätigen.

## Grundsätze

- Datenminimierung & Zweckbindung: nur benötigte Felder, keine Art.-9-Daten.
- Retention ist **pro Event konfigurierbar** (`events.retention_days`,
  `events.retention_mode`).
- `retention_days = NULL` → keine automatische Bereinigung (bewusste
  Entscheidung, muss begründet sein).
- Zwei Modi:
  - `anonymize` (Default): PII-Felder werden geleert/ersetzt, aggregierte
    Kennzahlen (Anzahl, Priorität, Score, Event-Bezug) bleiben für Reporting.
  - `hard_delete`: Lead + abhängige Daten werden gelöscht.
- **`legal_basis` / `consent_status` bleiben** auch nach Anonymisierung
  erhalten (Nachweisbarkeit), ohne Personenbezug (an anonymisierten Lead
  gebunden).

## Was wann bereinigt wird

| Datenart | Trigger | Aktion |
| --- | --- | --- |
| `leads` + `lead_answers` + `lead_notes` + `lead_tags` | `now() > events.ends_on + retention_days` | je `retention_mode` anonymisieren oder löschen |
| `attachments` (Objektspeicher-Datei + DB-Zeile) | wie Lead | löschen |
| `lead_merges.snapshot` | wie Lead des Events | Snapshot-PII entfernen bzw. Zeile löschen |
| Export-Dateien (Objektspeicher) | `now() > export.created_at + EXPORT_RETENTION_DAYS` (Default 7) | löschen; `exports`-Zeile (Metadaten) bleibt |
| `sync_receipts` | `now() > created_at + SYNC_RECEIPT_RETENTION_DAYS` (Default 30) | löschen |
| `sessions` (abgelaufen/revoked) | `expires_at < now()` oder `revoked_at` gesetzt | löschen (täglich) |
| `password_reset_tokens` | `expires_at < now()` oder `used_at` gesetzt | löschen (täglich) |
| `audit_log` | `now() > created_at + AUDIT_RETENTION_DAYS` (Default 365, konfigurierbar) | löschen — nur über Wartungsrolle, nicht über App-Rolle (append-only-Trigger) |

## Anonymisierungs-Regel für `leads` (Modus `anonymize`)

Gesetzt:
- `first_name = NULL`, `last_name = NULL`, `email = NULL`, `phone = NULL`,
  `website = NULL`, `linkedin = NULL`, `company = 'anonymisiert'`,
  `position = NULL`
- `lead_notes.body` → gelöscht; `lead_answers` mit Freitext → gelöscht,
  strukturierte Auswahlwerte dürfen bleiben (kein Personenbezug mehr)
- `anonymized_at = now()`
Behalten: `event_id`, `priority`, `lead_score`, `legal_basis`,
`consent_status`, `country`, `language`, Zeitstempel.

## Betroffenenrechte (technisch, Phase 2)

| Recht | Umsetzung |
| --- | --- |
| Auskunft / Datenübertragbarkeit | `GET /api/leads/:id/export` → JSON mit allen verknüpften Daten |
| Berichtigung | normale Bearbeitung, auditiert |
| Löschung | `POST /api/leads/:id/delete` mit `mode = hard \| anonymize` |
| Einschränkung | Status-Flag am Lead (Phase 2, falls benötigt) |

Jede Aktion erzeugt einen `audit_log`-Eintrag (`action = dsgvo.*`).

## Ausführung

- Job als planbarer Task (`npm run` Skript / systemd-Timer / Cron —
  z. B. eigener Compose-Service mit Timer; siehe `docs/HETZNER_DEPLOYMENT.md`).
- Läuft mit einer DB-Rolle, die auch `DELETE` auf operativen Tabellen darf
  (nicht die reine App-Rolle).
- Jeder Lauf schreibt eine Zusammenfassung nach `audit_log`
  (`action = retention.run`, `metadata = { anonymized, deleted }`).
- **Testbarkeit:** Integrationstest mit künstlich zurückdatiertem
  `ends_on`; prüft, dass PII entfernt und Kennzahlen erhalten sind
  (Phase 2 / qa-agent).

## Konfigurierbare Werte (ENV, Defaults)

```
EXPORT_RETENTION_DAYS=7
SYNC_RECEIPT_RETENTION_DAYS=30
AUDIT_RETENTION_DAYS=365
```

## Offen

- OQ-6: Standard-`retention_days` nach Messe (Vorschlag 365) + Default-Modus
  (Vorschlag `anonymize`) rechtlich bestätigen.
- Aufbewahrung `audit_log` an gesetzliche/vertragliche Nachweispflichten
  angleichen.
