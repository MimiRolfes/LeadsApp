# docs/threat-model.md — humatter Leads (Entwurf)

Status: Entwurf durch plan-agent für Gate 1. Wird durch security-agent (Gate 3) vertieft und mit `docs/security-review.md`, `docs/privacy-data-flow.md`, `docs/compliance-gaps.md` ergänzt.
Datum: 2026-08-31

> Kein Security-Theater: Dieses Dokument behauptet keine Vollständigkeit, keine Zertifizierung und keine „EU-Zulassung". Finale rechtliche und sicherheitstechnische Prüfung sowie organisatorische Maßnahmen bleiben erforderlich.

---

## 1. Schutzobjekte (Assets)
| Asset | Klasse | Warum schützenswert |
|---|---|---|
| B2B-Kontaktdaten (Name, geschäftl. E-Mail/Tel, Position, Firma) | personenbezogen | DSGVO, Reputationsschaden bei Leak |
| Gesprächsdaten (Notizen, Interessen, Use Case, Qualifizierung) | personenbezogen, teils bewertend | Freitext kann sensible Angaben enthalten → Minimierung |
| Rechtsgrundlage/Einwilligungsstatus | Compliance-Nachweis | muss unmanipuliert & getrennt vom Score sein |
| Auth-Credentials / Sessions | Geheimnis | Kontoübernahme |
| Uploads (Visitenkarten-Fotos/Scans) | personenbezogen | können weitere PII enthalten |
| Audit-Log | Integritätsnachweis | manipulationsarm halten |
| Exporte (CSV/XLSX/JSON) | Massen-PII | Exfiltration in einem Schritt |
| Backups | Massen-PII | Verschlüsselung + Zugriffskontrolle |

## 2. Akteure / Vertrauensgrenzen
- **Anonym / Internet** → nur Login, Passwort-Reset, statische Assets.
- **Teammitglied/Scanner** → eigene + zugewiesene Leads im zugewiesenen Event.
- **Messe-Manager** → Event-Konfiguration, alle Leads des Events, Reports, Merge, Export.
- **Admin** → global: Nutzer/Rollen, Events, Retention, Integrationen, Audit.
- **Read-only** → nur lesen.
- **Drittanbieter** (potenziell): Object Storage, E-Mail-Versand, OCR — je EU-Verarbeitung/AVV zu prüfen (OQ-4/OQ-5).
- Grenzen: Client↔Server (HTTPS), Server↔DB, Server↔Storage, Server↔Drittanbieter.

## 3. Bedrohungen (STRIDE, priorisiert)

### Spoofing / AuthN
| ID | Bedrohung | Gegenmaßnahme |
|---|---|---|
| T-A1 | Credential Stuffing / Brute Force | Rate Limit (IP+Account), Backoff, Argon2id, generische Fehler, optional 2FA |
| T-A2 | Session-Diebstahl (XSS/Netz) | HttpOnly/Secure/SameSite-Cookie, HSTS, strikte CSP, kurze Idle-TTL |
| T-A3 | Session-Fixation | Session-Rotation bei Login |
| T-A4 | Passwort-Reset-Missbrauch | single-use, kurz gültiger, gehashter Token; kein User-Enumeration-Leak |
| T-A5 | Deaktivierter Nutzer bleibt aktiv | Server-Session-Store, sofortige Invalidierung, „revoke all" |

### Tampering / Elevation (AuthZ)
| ID | Bedrohung | Gegenmaßnahme |
|---|---|---|
| T-Z1 | IDOR/BOLA auf Lead/Export/Attachment/Follow-up per ID | zentrale Policy, `event_id`-Scope in jeder Query, negative Tests, optional RLS |
| T-Z2 | Vertikale Rechteausweitung (Rolle im Request fälschen) | Rolle nur serverseitig aus `event_members`/DB, kein Client-Trust |
| T-Z3 | Mass Assignment (`owner_id`, `lead_score`, `status` mitsenden) | strikte Zod-DTOs, Whitelist, Service ignoriert Fremdfelder |
| T-Z4 | Event-übergreifender Zugriff | `event_id`-Scoping überall, Isolationstests (`adr/0002`) |
| T-Z5 | Parameter-Tampering bei Export-Feldmapping | Allowlist exportierbarer Felder |

### Injection / Input
| ID | Bedrohung | Gegenmaßnahme |
|---|---|---|
| T-I1 | SQL Injection | ORM/parametrisiert, keine String-Konkatenation |
| T-I2 | Stored XSS über Notizen/Tags/Namen | React-Escaping, CSP ohne inline-script, Sanitizing bei HTML/CSV-Export (Formula-Injection: führende `= + - @` neutralisieren) |
| T-I3 | CSV/XLSX Formula Injection in Downloads | Präfix-Escaping / Quoting beim Export |
| T-I4 | SSRF über „Website/LinkedIn"-Felder (falls serverseitig geladen) | keine serverseitigen Fetches auf Nutzer-URLs im MVP |
| T-I5 | Überlange Payloads / Nesting | Request-Size-Limit, Zod-Längen-/Tiefenlimits |

### Repudiation
| ID | Bedrohung | Gegenmaßnahme |
|---|---|---|
| T-R1 | Abstreiten von Export/Delete/Merge | append-only `audit_log`, DB-Rolle ohne UPDATE/DELETE darauf |
| T-R2 | Audit-Manipulation | getrennte Tabelle, minimale Rechte, ggf. Hash-Chain (Phase 2) |

### Information Disclosure
| ID | Bedrohung | Gegenmaßnahme |
|---|---|---|
| T-D1 | PII in Logs / Fehlermeldungen | strukturiertes Logging mit Redaction, generische API-Fehler, keine Stacktraces |
| T-D2 | PII in URLs / Query-Strings | IDs im Pfad, keine PII in Query; kein PII in Referrer |
| T-D3 | Unsignierte/ratebare Attachment-URLs | kurzlebige signierte URLs nach Policy-Check, zufällige Keys |
| T-D4 | Offline-Restdaten auf geteiltem Gerät | Bereinigung nach Sync, kein PII-Massencache, Logout-Handling |
| T-D5 | Backups unverschlüsselt / zugänglich | Verschlüsselung at rest, Zugriffskontrolle, Restore-Test |
| T-D6 | Nicht-EU-Datenresidenz durch Drittanbieter | EU-Region für App/DB/Storage/Provider verifizieren vor Go-Live |

### Denial of Service
| ID | Bedrohung | Gegenmaßnahme |
|---|---|---|
| T-N1 | Massen-Requests / teure Exporte | Rate Limits, Export-Jobs asynchron + limitiert |
| T-N2 | Upload-Flooding / große Dateien | Größenlimit, Anzahl-Limit pro Lead, Auth vor Upload-Signatur |
| T-N3 | Sync-Replay-Storm | Idempotenz + Backoff clientseitig |

### Datenschutz-spezifisch
| ID | Bedrohung | Gegenmaßnahme |
|---|---|---|
| T-P1 | Übermäßige Datensammlung / Art.-9-Daten | Feldminimierung, keine sensiblen Strukturfelder, Freitext-Hinweis in UX |
| T-P2 | Marketing-Einwilligung erzwungen / mit Score vermischt | Einwilligung optional, versioniert, getrennt vom Lead-Score gespeichert |
| T-P3 | Fehlende Löschung/Retention | konfigurierbare Retention, Cron-Job, testbare Delete/Anonymisierung |
| T-P4 | Betroffenenrechte technisch nicht erfüllbar | Auskunft/Export/Berichtigung/Löschung als Endpunkte + UI |
| T-P5 | Undokumentierte Datenflüsse / Auftragsverarbeiter | `privacy-data-flow.md` + AV-Verzeichnis (security-agent) |

### Supply Chain / Betrieb
| ID | Bedrohung | Gegenmaßnahme |
|---|---|---|
| T-S1 | Verwundbare Dependencies | Dependency-Scan im CI, Lockfile, zeitnahe Updates |
| T-S2 | Secrets im Repo | Secret-Scan im CI, `.env.example` nur mit Namen, Secret Manager |
| T-S3 | Kompromittierte Build-Pipeline | minimale CI-Rechte, geschützte Branches, Review-Pflicht |

## 4. Pen-Test-Minimum (aus `CLAUDE.md`, für qa-/security-agent)
Unauthenticated access · horizontale/vertikale Privilege Escalation · IDOR/BOLA · Parameter-Tampering · Injection · XSS · CSRF (wo relevant) · Brute Force / Rate Limiting · Session-Invalidierung · Export/Delete/Upload/Merge-Autorisierung · Offline-Sync-Replay · Race Conditions (Merge, Doppel-Sync) · Secrets-Exposure · Sensitive Logging.

## 5. Docker-/Netzwerk-Sicherheit (ADR 0004)

| ID | Bedrohung | Gegenmaßnahme |
|---|---|---|
| T-C1 | DB öffentlich erreichbar | `db` ohne veröffentlichten Port, nur im `backend_net` (`internal: true`); `compose.override.yaml` (Host-Ports) nie deployt |
| T-C2 | Frontend erreicht DB direkt | Frontend ist nicht im `backend_net` — nur `backend`/`migrate` |
| T-C3 | Container-Ausbruch / Privesc | non-root (uid 1001), `no-new-privileges`, gepinnte Basis-Images, kein `node_modules` im Backend-Runtime |
| T-C4 | Secrets im Image / in `compose.yaml` | nur ENV aus `.env` (chmod 600) / Secret-Store; `.dockerignore` schließt `.env*` aus |
| T-C5 | Destruktiver DB-Reset beim Deploy | keine Auto-Resets; nur idempotente, additive Migrationen; Volume überlebt `down`/Rebuild |
| T-C6 | Datenverlust bei Volume-/Serverausfall | zusätzliches verschlüsseltes Off-Site-`pg_dump`-Backup (`docs/backup-restore.md`) |
| T-C7 | Image-Supply-Chain | gepinnte Tags, `npm ci` mit Lockfile, `npm audit` im CI |

## 6. Offene Sicherheits-/Compliance-Punkte
- **`REQUIRES_PRODUCTION_VERIFICATION`** (Hetzner): TLS/HTTPS, Firewall,
  DNS, öffentliche Ports, Server-/Docker-Hardening & Patching, Backup-
  Ausführung + Restore-Test auf Prod, Monitoring, Hosting-/Datenresidenz.
  Checkliste in `docs/HETZNER_DEPLOYMENT.md` §16.
- EU-Region + AVV für E-Mail / OCR / externen Objektspeicher (OQ-4/OQ-5).
- Endgültige RLS-Entscheidung (`adr/0002`, Tendenz: an).
- 2FA verpflichtend ja/nein (OQ-10).
- Retention-Fristen (OQ-6).
- DPIA-Notwendigkeit rechtlich bewerten lassen (organisatorisch).
- Hash-Chain / WORM für Audit-Log: Phase 2 erwägen.
