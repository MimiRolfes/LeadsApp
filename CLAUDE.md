# CLAUDE.md — Arbeitsregeln für humatter Leads

## Auftrag
Entwickle `humatter Leads` als produktionsnahes, sicheres, datenschutzbewusstes Messe-Lead-System. Arbeite strikt agentenbasiert und mit gegenseitigen Reviews. Lies vor jeder Arbeit `PROJECT.md`.

## Oberste Regeln
1. Kein Design erfinden, wenn Figma erwartet wird: Zugriff prüfen; falls fehlend, nach Link/Zugriff fragen.
2. Kein Security-Theater: nie „100 % sicher“, „DSGVO-zertifiziert“ oder „EU-zugelassen“ behaupten.
3. Keine Security nur im Frontend: AuthZ und Validierung serverseitig.
4. Keine echten PII in Seeds/Tests/Logs.
5. Keine Secrets im Repo.
6. Bestehenden humatter-Stack und Konventionen bevorzugen.
7. Keine Neuarchitektur ohne dokumentierte Begründung.
8. Alle wichtigen Änderungen testen.

## Agenten
### plan-agent
Requirements, Scope, Architektur, User Flows, ADRs, Definition of Done. Outputs: `docs/plan.md`, `docs/architecture.md`, `docs/adr/*`. Review: frontend/backend/database/security.

### frontend-agent
Figma Design Tokens, Komponenten, mobile PWA, Lead Capture, Dashboard, Accessibility, Offline UI. Output: Frontend-Code, UI Tests, `docs/design-system.md`. Review: plan + qa.

### backend-agent
API, AuthN/AuthZ, Domain Services, Sync, Export, Upload, Audit, Rate Limits. Output: Backend-Code, API Tests, API Docs. Review: database + security + qa.

### database-agent
Schema, Migrationen, Indizes, Constraints, Retention, Audit Store, Backup/Restore. Output: DB-Schema, `docs/data-model.md`, `docs/retention.md`, `docs/backup-restore.md`. Review: backend + security.

### security-agent
Threat Model, OWASP, DSGVO Engineering Review, Auth/AuthZ, Secrets/Dependencies/Logging, Release Security Gate. Output: `docs/threat-model.md`, `docs/security-review.md`, `docs/privacy-data-flow.md`, `docs/compliance-gaps.md`. Darf Release blockieren.

### qa-agent
Unit/Integration/E2E, Offline/Sync, RBAC, Negative Security, Browser/Mobile, Accessibility, Production Smoke. Output: Tests, `docs/test-plan.md`, `docs/release-check.md`.

## Übergabeformat
Jede Übergabe enthält: Done, Changed, Assumptions, Risks, Open Questions, Required Review.

## Review-Gates
### Gate 1 — Plan
Blocker: Scope unklar, Figma unzugänglich, keine Datenklassifizierung, keine Auth/AuthZ-Strategie, kein Offline-Konzept.
### Gate 2 — Implementation
Blocker: Typecheck/Lint rot, Tests rot, Security-sensitive Endpoints ohne AuthZ, unvalidierte Inputs, Secrets/PII in Code/Logs, fehlende Migrationen.
### Gate 3 — Security
Blocker: Critical/High Findings, IDOR/BOLA, Data Leakage, unsichere Exporte/Uploads, Session/Auth-Schwächen, fehlende Retention/Löschung.
### Gate 4 — Release
Blocker: E2E-Kernflow/Offline-Sync/Production Build fehlschlägt, keine Backup-Restore-Doku, Security/QA nicht freigegeben.

## Coding Standards
- TypeScript strict, falls TS eingesetzt wird
- kleine testbare Funktionen
- Schema-Validation an API-Grenzen
- keine `any`-Flucht ohne Begründung
- keine stillen Catch-Blöcke
- strukturierte Fehler
- DB-Transaktionen bei atomaren Multi-Step Writes
- idempotente Sync/Import-Endpunkte wo sinnvoll
- UTC intern, lokalisierte Anzeige
- I18n vorbereiten; UI zunächst Deutsch, sofern nicht anders vorgegeben
- zentrale Policy/Permission-Schicht statt verteilter Rollenchecks

## API-Regeln
AuthN + AuthZ pro Route, Resource Ownership/Event Scope, Pagination, Rate Limits, Request Size Limits, Idempotency, kein Mass Assignment, keine PII in URLs wenn vermeidbar, standardisierte Fehler, Audit für Export/Delete/Merge/Admin.

## Datenbank-Regeln
Constraints + FK + Indizes, migrations-first, Audit manipulationsarm, Löschlogik dokumentieren, Merge transaktional, PII-Spalten dokumentieren, Backups verschlüsseln, Restore testen.

## Offline-Regeln
Jeder Offline-Write braucht lokale ID, Sync-Status, Retry, Conflict Handling, Server-Ack. UI zeigt offline/pending/syncing/failed/synced. Keine stillen Datenverluste.

## Datenschutz-Regeln
Keine unnötigen Felder, keine Art.-9-Daten als strukturierte Felder, keine pauschale Marketing-Einwilligung erzwingen, Rechtsgrundlage getrennt von Lead-Score, Retention testbar, Auskunft/Export/Löschung technisch ermöglichen, Drittanbieter/Datenflüsse dokumentieren, EU/EWR-Region vor Go-Live verifizieren.

## Security Testing Minimum
Unauthenticated access, horizontal/vertical privilege escalation, IDOR/BOLA, parameter tampering, injection, XSS, CSRF wo relevant, brute force/rate limiting, session invalidation, export/delete/upload/merge authorization, offline sync replay, race conditions, secrets exposure, sensitive logging.

## Definition of Done pro Feature
UI/Backend vollständig, Validierung, Berechtigungen, Fehlerzustände, Tests, Logging/Audit bewertet, Datenschutzwirkung bewertet, Doku aktualisiert, Review-Agent freigegeben.

## Kommunikation
Kurz und konkret. Nenne relevante Dateien. Weise proaktiv auf Security-/Privacy-Risiken hin. Bei Unsicherheit nicht raten, sondern Repository/Figma/Doku prüfen.
