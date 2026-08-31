# PROJECT.md — humatter Messe Leads App

## Projektname
**humatter Leads**

## Zweck
Interne, mobile-first Lead-Capture- und Lead-Management-Anwendung für Messeauftritte von humatter. Sie soll Gespräche am Stand digital erfassen, Kontakte qualifizieren und die Nachbereitung beschleunigen. Mobile Erfassung + zentrales Desktop-Dashboard.

## Produktkontext
humatter ist eine Recruiting-Plattform mit dem Leitgedanken „Human first, AI powered“. Bestehende humatter-Figma-Dateien sind die visuelle Source of Truth.

Website: https://humatter.de/

Wenn Figma nicht verfügbar ist, muss vor der Frontend-Umsetzung nach einem Figma-Link bzw. Zugriff gefragt werden.

## Nutzer
### Admin
Benutzer/Rollen, Events, Fragebögen, Exporte, Retention, Audit, Integrationen.
### Messe-Manager
Event konfigurieren, Team zuweisen, Fragenkatalog, Leads/Reports, Follow-ups.
### Teammitglied / Scanner
Leads erfassen, scannen, Gesprächsbericht, Notizen/Tags, Follow-up, eigene/zugewiesene Leads.
### Optional Read-only
Reports/Leads lesen, keine Änderungen.

## Haupt-Use-Case
1. Aktives Event öffnen.
2. „Lead erfassen“.
3. Kontaktdaten scannen oder manuell eingeben.
4. Daten prüfen/korrigieren.
5. Gesprächsfragen/Notizen ergänzen.
6. Lead priorisieren.
7. Follow-up + Owner setzen.
8. Speichern.
9. Offline bei schlechtem Netz, später synchronisieren.
10. Nach der Messe filtern, exportieren bzw. über Integrationen weiterverarbeiten.

## MVP
- Event Management
- Lead Capture: manuell, Visitenkarte/Kamera, QR/Barcode
- Validierung, Duplicate Check
- konfigurierbare Gesprächsfragen, Notizen, Tags, Hot/Warm/Cold, Follow-up, Owner
- Lead-Liste, Filter, Suche, Detailansicht, Änderungsverlauf, Merge
- PWA + Offline-Capture + Sync Queue + Konfliktbehandlung
- Reporting: Leads total, pro Nutzer, Prioritäten, Follow-up, Funnel
- CSV/XLSX + JSON/API Export, Audit Logging
- Auth, RBAC, Audit, Encryption, Retention, Delete/Export Workflows, EU/EWR-Hosting-Ziel

## Phase 2 / Optional
Kiosk-Modus, Sprache-zu-Text, NFC, CRM-Konnektoren, automatisierte Follow-up-Entwürfe, Termin-/Raumbuchung, digitale Mediathek, erweiterte Reports, frei konfigurierbare Scoring-Regeln, externe Badge-Provider.

## Designprinzipien
- Figma ist Source of Truth.
- Mobile first, wenig Tippen, große Touch Targets.
- Desktop für Analyse/Nachbereitung.
- Kein generisches Admin-Template.
- WCAG 2.2 AA anstreben.

## Datenklassen
### B2B-Kontaktdaten
Name, geschäftliche E-Mail, Telefon, Position, Unternehmen, Business-Profil optional.
### Gesprächsdaten
Notizen, Interessen, Use Case, Follow-up, Qualifizierung.
### Systemdaten
Event, Owner, Zeitstempel, Audit, Sync.

Besondere Kategorien personenbezogener Daten nach Art. 9 DSGVO sind nicht vorgesehen und sollen weder als strukturierte Felder abgefragt noch gefördert werden. Freitext-UX soll unnötige sensible Angaben vermeiden.

## Datenschutz-Ziel
Privacy by Design/Default: Datenminimierung, Zweckbindung, Retention, Export/Löschung, Auditierbarkeit, EU/EWR-Datenresidenz, Auftragsverarbeiter dokumentieren. Finale rechtliche Prüfung bleibt erforderlich.

## Security-Ziel
Serverseitige Autorisierung, Least Privilege, sichere Sessions, Rate Limits, Security Headers, sichere Uploads, Audit, Logging ohne unnötige PII, Secret Management, Dependency Scanning, Backups/Restore, negative Security Tests.

## Nicht-Ziele
- kein ATS/Bewerbermanagement
- keine automatisierten HR-Entscheidungen
- kein unnötiges Sammeln privater/sensibler Daten
- kein unkontrolliertes Scraping
- kein automatischer Marketingversand ohne geklärte Rechtsgrundlage
- keine Behauptung einer Zertifizierung, die nicht tatsächlich vorliegt

## Funktionale Inspiration
snapAddy BusinessCards und VisitReport: Visitenkarten-/Badge-/QR-Erfassung, mobile App + Desktop-Dashboard, Offline-Nutzung, konfigurierbare Gesprächsberichte, Reports, CRM-/Datenexport, Follow-up-Workflow und Duplikatprüfung. Keine 1:1-Kopie von UI, Texten oder proprietären Abläufen.
