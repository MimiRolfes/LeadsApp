# ADR 0003 — Offline- & Sync-Strategie

- Status: Vorgeschlagen
- Datum: 2026-08-31
- Kontext: `MASTER_PROMPT` §2I, `CLAUDE.md` Offline-Regeln

## Kontext
Messehallen haben oft schlechtes Netz. Lead-Erfassung muss offline funktionieren, ohne Datenverlust. Jeder Offline-Write braucht lokale ID, Sync-Status, Retry, Konfliktbehandlung, Server-Ack. UI muss `offline | pending | syncing | failed | synced` zeigen.

## Entscheidung

### Lokale Persistenz
- **IndexedDB** „Outbox"-Store: `{ localId: uuidv4, type: 'lead.create'|'lead.update'|'followup.update', payload, syncStatus, attempts, lastError, createdAt, baseVersion? }`.
- Nur der offene Arbeitsvorrat wird lokal gehalten. Nach erfolgreichem Sync werden PII-haltige Payloads gelöscht; es bleibt ein schlankes Mapping `localId → serverId` + Status.
- Kein Langzeit-Offline-Cache ganzer Lead-Listen mit PII (Datenminimierung). Read-Caching nur für App-Shell + unkritische Referenzdaten (z. B. Fragenkatalog des aktiven Events).

### Identität & Idempotenz
- Client generiert `localId` (UUID v4) **vor** dem ersten Speichern.
- `localId` ist zugleich `Idempotency-Key` im Request-Header und wird serverseitig in `sync_receipts` gespeichert.
- Wiederholter Request mit gleichem Key → Server gibt existierendes Ergebnis zurück (200), legt nichts Neues an.
- DB: `leads.client_local_id` UNIQUE pro `event_id`.

### Sync-Ablauf
1. Trigger: `online`-Event · Background Sync API (falls verfügbar) · periodisches Polling (z. B. alle 60 s bei offener App) · manueller Button „Jetzt synchronisieren".
2. Outbox **sequentiell** abarbeiten (Reihenfolge erhalten; verhindert Update-vor-Create).
3. Pro Item: Request mit `Idempotency-Key`. Status im UI: `syncing`.
4. Antwort-Handling:
   - `200/201` → `synced`, Mapping speichern, Payload bereinigen.
   - `409 Conflict` → Konfliktstrategie (unten).
   - `400/403/422` (dauerhaft) → `failed`, Fehlermeldung im UI, kein Auto-Retry, Nutzer bearbeitet/verwirft bewusst.
   - `429/5xx`/Netzfehler → bleibt `pending`, exponentielles Backoff (z. B. 2^attempts · Basis, Deckel 5 min), `attempts++`.
5. Maximalversuche für transiente Fehler: hoch, aber begrenzt; danach `failed` mit klarer Meldung. **Nie stilles Verwerfen.**

### Konfliktstrategie (409)
Server liefert aktuellen Serverstand + `serverVersion`. Auflösung nach Feldtyp:
- **Strukturierte Einzelwerte** (Kontaktfelder, Priorität, Score, Follow-up-Datum, Rechtsgrundlage): Last-Writer-Wins. Wenn sowohl Server als auch Client seit `baseVersion` geändert haben → `failed` + UI zeigt Feld-Diff, Nutzer wählt.
- **Additive Mengen** (Tags, Notizen): Union/Append, keine Löschung durch Sync.
- **Löschungen**: gewinnen nur, wenn explizit vom Nutzer ausgelöst und auditiert; Sync löscht nie implizit.

### Sicherheits-/Datenschutzaspekte
- Geteilte Geräte: Logout entfernt Session; Outbox-Anzeige nur für angemeldeten Nutzer; Bereinigung nach Sync begrenzt Restdaten.
- Replay-Schutz: Idempotency-Keys + Server-Session-Bindung (`sync_receipts.user_id`).
- Kein Schreiben in fremde Events durch manipulierte Payload → AuthZ-Policy prüft Event-Scope serverseitig.

## Alternativen
| Option | Pro | Contra |
|---|---|---|
| CRDT / automatisches Merge | elegante Konfliktfreiheit | Overkill für kurzen Formular-Flow, Lib-Komplexität |
| „Server gewinnt immer" | einfach | Datenverlust am Stand erfasster Angaben — verstößt gegen „keine stillen Verluste" |
| Nur manueller Sync | volle Kontrolle | Nutzer vergisst → Verlustrisiko; wir kombinieren auto + manuell |
| Volles Offline-Read-Replica mit PII | bequem | Datenschutz-/Sicherheitsrisiko auf geteilten Geräten |

## Konsequenzen
- Backend-Endpunkte für `lead.create/update` und `followup.update` müssen idempotent sein und `409` mit Versionsinfo liefern.
- `sync_receipts`-Tabelle + `client_local_id`-UNIQUE nötig (database-agent).
- Playwright-E2E muss Offline→Online, Doppel-Submit, Konflikt und `failed`-Pfad abdecken (qa-agent).
- UI braucht dedizierte Statusanzeige + „failed"-Auflösungsansicht (frontend-agent, nach Figma).
