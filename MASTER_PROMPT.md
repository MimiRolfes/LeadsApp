# MASTER PROMPT — humatter Leads App

Du arbeitest als autonomes, multi-agent-fähiges Senior-Product-&-Engineering-Team. Ziel ist eine produktionsreife **Lead-Capture- und Lead-Management-App für Messeauftritte von humatter**.

## 0. Erst analysieren, dann bauen
1. Lies zuerst `PROJECT.md`, `CLAUDE.md`, den vorhandenen Code / das Repository und alle vorhandenen humatter-Figma-Dateien.
2. Wenn du **keinen Zugriff auf die humatter-Figma-Dateien** hast, stoppe nach der initialen Projektanalyse und frage explizit nach dem Figma-Link bzw. Zugriff. Erfinde keine Design-Tokens.
3. Prüfe, ob bereits Stack, Auth-System, Backend, API-Konventionen, Deployment-Setup oder gemeinsame humatter-Komponenten existieren. Wiederverwenden statt duplizieren.
4. Falls Greenfield: schlage nach der Planungsphase einen geeigneten Stack vor. Bevorzugt TypeScript end-to-end, React/Next.js als Web/PWA, PostgreSQL, typisierte APIs, serverseitige Validierung und EU-basiertes Hosting. Bestehender humatter-Stack hat Vorrang.

## 1. Produktziel
Baue eine mobile-first Messe-Leads-App, mit der humatter-Mitarbeitende Kontakte direkt auf Messen erfassen, qualifizieren, mit Gesprächsnotizen anreichern, priorisieren und anschließend strukturiert nachbearbeiten können. Die App soll schnelle mobile Erfassung vor Ort mit einem zentralen Desktop-Dashboard verbinden.

Funktionale Inspiration, nicht kopieren:
- https://snapaddy.com/de/prices/businesscards/
- https://snapaddy.com/de/solutions/use-cases/trade-show-lead-capture/
- https://humatter.de/

## 2. Kern-Features
### A. Authentifizierung & Benutzer
- sicherer Login
- Rollen: Admin, Messe-Manager, Teammitglied/Scanner, optional Read-only
- Session-Management, Logout auf allen Geräten, Passwort-Reset bzw. SSO je nach bestehendem Stack
- 2FA sofern passend
- Benutzer aktivieren/deaktivieren

### B. Messe-/Event-Verwaltung
- mehrere Events anlegen
- Eventname, Ort, Datum, Team, Status
- Event-Dashboard: Leads gesamt, Leads pro Teammitglied, Hot/Warm/Cold, Leads pro Tag, Follow-up-Status, Conversion-Funnel
- Teammitglieder einem Event zuweisen

### C. Lead-Erfassung
Mehrere Wege:
1. manuelle Eingabe
2. Visitenkarten-Scan per Kamera
3. QR-/Barcode-Scan
4. optional NFC
5. Foto/Scan-Upload
6. optional Kiosk-/Self-Service-Modus

Basisdaten: Vorname, Nachname, Unternehmen, Position, geschäftliche E-Mail, Telefon optional, Website optional, LinkedIn/Xing optional, Land, Sprache, Quelle/Event, erfassendes Teammitglied, Zeitstempel.

Scan-Ergebnisse vor Speicherung immer bestätigen/korrigieren lassen. Confidence/Unsicherheit sichtbar machen, wenn OCR eingesetzt wird.

### D. Gesprächsbericht / Qualifizierung
- Freitext-Notizen
- konfigurierbarer Fragenkatalog
- Interessen-Tags
- Produktinteresse
- Unternehmensgröße
- Rolle im Buying Center
- konkreter Use Case
- aktuelles Recruiting-Problem
- Zeithorizont
- Budgetstatus optional
- gewünschter nächster Schritt
- Hot/Warm/Cold
- transparenter, konfigurierbarer Lead-Score
- Follow-up-Datum und Verantwortlicher
- Rechtsgrundlage/Einwilligungsstatus getrennt vom Sales-Score

### E. Notizen & Medien
- Textnotizen
- optional Sprache-zu-Text nur bei datenschutzkonformer Lösung
- restriktive Upload-Typen/-Größen, Validierung/Malware-Schutz, klare Retention

### F. Lead-Liste & Detailansicht
- Suche, Filter, Sortierung, Tags, Status, Owner, Event, Priorität, Follow-up
- Duplikaterkennung und Merge mit Audit-Trail
- Lead-Historie und Änderungsverlauf

### G. Follow-up
- Aufgaben, Fälligkeit, offen/erledigt/überfällig
- Vorlagen für Follow-up-Texte
- E-Mail-Entwurf optional; kein automatischer Versand ohne explizite Freigabe
- Ansicht „Heute nachfassen“

### H. Export / CRM
- CSV/XLSX, JSON/API
- Feldmapping
- generische CRM-Integrationsschicht vorbereiten
- Export protokollieren und separat berechtigen

### I. Offline/PWA
- mobile-first PWA
- Offline-Erfassung
- angemessen geschützte lokale Zwischenspeicherung
- Sync-Warteschlange, Konfliktstrategie, Retry, Sync-Status
- keine Datenverluste bei schlechtem Netz
- Offline-Daten nach erfolgreichem Sync gemäß Sicherheitskonzept bereinigen

### J. Analytics
- Event-KPIs, Lead-Anzahl, qualifizierte Leads, Hot/Warm/Cold, Team-Aktivität, Follow-up-Quote, Zeit bis Follow-up, Exporte

## 3. UX / Design
- humatter-Figma ist Source of Truth für Farben, Typografie, Spacing, Radius, Komponenten, Icons und Tonalität.
- Keine generischen AI-SaaS-Designs.
- Mobile Erfassung mit einer Hand bedienbar; primärer Flow extrem kurz.
- Desktop-Dashboard informationsreicher.
- WCAG 2.2 AA anstreben.
- Vollständige Zustände: loading, empty, error, offline, sync pending, permission denied, duplicate found.

## 4. Datenschutz, Security & EU-Compliance
WICHTIG: Behaupte niemals, die Software sei „vollständig sicher“, „zertifiziert“ oder „EU-zugelassen“. Entwickle Security-by-Design und Privacy-by-Design; finale DSGVO-/EU-Rechtskonformität sowie Zertifizierungen erfordern organisatorische Maßnahmen und ggf. Datenschutz-/Legal-/Security-Audit.

### DSGVO / Privacy by Design
- Datenminimierung, Zweckbindung, Rechtsgrundlage, Transparenz
- Lösch-/Aufbewahrungskonzept
- Betroffenenrechte technisch unterstützen: Auskunft, Berichtigung, Löschung, Export, Einschränkung soweit relevant
- Einwilligungen nur bei geeigneter Rechtsgrundlage, versioniert/nachweisbar falls genutzt
- EU-/EWR-Datenresidenz als Deployment-Ziel
- Drittlandtransfers nur mit dokumentierten Mechanismen
- Auftragsverarbeiter inventarisieren
- technische Inputs für Verzeichnis von Verarbeitungstätigkeiten / DPIA bereitstellen
- konfigurierbare Retention/Auto-Delete-Regeln

### Security by Design
Orientierung an OWASP ASVS / OWASP Top 10:
- TLS, Encryption at rest
- Secrets nie im Repo; Secret Manager verwenden
- serverseitige AuthZ auf jedem geschützten Endpoint
- RBAC/Least Privilege
- Allowlist-Validierung, Output-Encoding, parametrisierte Queries/ORM
- CSRF-Schutz wo relevant
- sichere Cookies: HttpOnly, Secure, SameSite
- Rate Limiting, Abuse-Schutz
- CSP/Security Headers, restriktives CORS
- sichere Uploads
- Audit-Logs für Security/Privacy-Aktionen
- keine unnötige PII in Logs
- keine Stacktraces/Secrets in Fehlerantworten
- Dependency-, SAST- und Secret-Scanning
- verschlüsselte Backups + Restore-Test
- RPO/RTO dokumentieren
- IDOR/BOLA, Tenant-/Event-Isolation, Mass Assignment gezielt testen

### Datenbank
- PostgreSQL oder bestehende humatter-DB
- normalisiertes dokumentiertes Schema, FK/Constraints, Migrationen, Indizes
- Audit Trail getrennt von operativen Datensätzen
- PII klassifizieren
- Mandanten-/Event-Isolation explizit modellieren
- Backups verschlüsselt, minimale DB-Berechtigungen

## 5. Multi-Agent-Arbeitsweise
### Agent 1 — PLAN / ARCHITECT
Analysiert Anforderungen, Repository, Figma-Zugriff, User Flows, MVP/Phase 2, Architektur, Datenflüsse, Threat Model auf hoher Ebene, API-Grenzen, Definition of Done und Aufgabenplan. Noch keine großen Implementierungen.

### Agent 2 — FRONTEND
Extrahiert Design-System aus Figma, baut responsive PWA, Lead-Capture-Flows, Dashboard, Formulare, Offline-UX und Accessibility. Vor Übergabe: Typecheck, Lint, UI-Tests, responsive states, Accessibility-Smoke-Checks.

### Agent 3 — BACKEND
Verantwortet APIs, AuthN/AuthZ, Event-/Lead-/Follow-up-Services, Upload-Pipeline, Export, Sync, Rate Limits, Auditing, Validierung und Fehlerbehandlung. Security-Agent reviewt zwingend.

### Agent 4 — DATABASE
Verantwortet ER-Modell, Schema, Migrationen, Constraints, Indizes, Retention/Deletion, Audit-Struktur, Backup/Restore, Datenklassifizierung und Isolation. Review durch Backend + Security.

### Agent 5 — SECURITY / PRIVACY
Threat Model, OWASP Review, DSGVO Engineering Review, Auth/AuthZ Review, Datenfluss-/Drittanbieterprüfung, Logging/Secrets/Dependencies, Pen-Test-Checkliste, Compliance-Gaps. Darf Release bei Critical/High Findings blockieren.

### Agent 6 — QA / TEST
Unit-, Integration-, API-, E2E-, Offline/Sync-, Duplicate/Merge-, RBAC-, Negative-Security-, Export/Delete/Retention-, Accessibility- und Production-Smoke-Tests.

## 6. Gegenseitige Gegenchecks
1. Plan: Review durch Frontend, Backend, Database, Security.
2. Frontend: Review durch Plan + QA.
3. Backend: Review durch Database + Security + QA.
4. Database: Review durch Backend + Security.
5. Security prüft Gesamtanwendung vor Release.
6. QA führt finalen E2E-Test durch.
7. Release Candidate nur ohne offene Critical/High Findings.

Findings immer mit Severity, betroffener Datei/Funktion, Risiko, Reproduktion, Fix und Status.

## 7. Repo-Regeln
- kleine nachvollziehbare Änderungen
- keine Komplett-Rewrites ohne Begründung
- bestehende Konventionen beibehalten
- keine Secrets oder echten PII-Testdaten committen
- `.env.example` pflegen
- Migrationen versionieren
- API/DB-Schema dokumentieren
- Architektur-/Security-/Compliance-Entscheidungen als ADRs dokumentieren

## 8. Erwartete Artefakte
- Frontend, Backend, DB-Schema + Migrationen, Seed-Daten
- README, `.env.example`
- Architekturübersicht, ER-Diagramm, API-Doku/OpenAPI sofern passend
- Threat Model, Security Checklist, Privacy/Data-Flow-Dokument, Retention-Konzept
- Teststrategie und automatisierte Tests
- Deployment-, Backup/Restore- und Incident-Response-Kurzdoku
- CHANGELOG und offene Compliance-/Security-Gaps

## 9. Abnahmekriterien
Release Candidate erst wenn:
- mobiler Kern-Lead-Flow funktioniert
- Offline-Capture/Sync getestet
- Duplikate sauber behandelt
- RBAC serverseitig durchgesetzt
- Exporte berechtigt/auditierbar
- Delete/Retention getestet
- keine Critical/High Security Findings
- Test-Suite grün
- Production Build erfolgreich
- Figma konsistent umgesetzt
- Security + QA dokumentiert freigegeben

## 10. Starte jetzt
Beginne ausschließlich mit Agent 1 — PLAN / ARCHITECT und liefere zuerst:
1. Repository-/Stack-Analyse
2. Figma-Zugriffsstatus
3. MVP-Scope
4. User Flows
5. Architektur
6. Datenmodell auf hoher Ebene
7. Threat-Model-Entwurf
8. Implementierungsplan
9. offene Fragen/Blocker

Falls Figma nicht verfügbar ist, frage nach dem Figma-Link, bevor du das visuelle Frontend implementierst.
