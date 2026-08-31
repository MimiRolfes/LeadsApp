# HETZNER_DEPLOYMENT.md — humatter Leads

Deployment-Handover für den Administrator des Hetzner-Servers.
Stand: 2026-08-31 · Architektur: ADR 0004.

Die Anwendung besteht aus **drei Docker-Services** in einem Compose-Projekt:

```
User → HTTPS → [Reverse Proxy] → frontend (Next.js PWA)
                                     │  proxyt /api/* intern
                                     ▼
                                  backend (Hono API)
                                     ▼
                              internes Docker-Netz (internal: true)
                                     ▼
                                  db (PostgreSQL) + persistentes Volume
```

- Der Browser spricht **nur** mit dem Frontend. `/api/*` wird serverseitig ans
  Backend weitergereicht (First-Party-Cookies, kein CORS).
- Das Backend ist **nicht** öffentlich; die **Datenbank** ist weder vom Host
  noch vom Internet noch vom Frontend erreichbar (eigenes `internal`-Netz).

Punkte, die ohne Zugriff auf den Server nicht real prüfbar sind, sind mit
**`REQUIRES_PRODUCTION_VERIFICATION`** markiert.

---

## 1. Voraussetzungen auf dem Server

| Anforderung | Detail |
| --- | --- |
| Linux-Host mit Docker Engine + Compose v2 | genaue Distribution/Version offen — `REQUIRES_PRODUCTION_VERIFICATION` |
| Ausgehende Netzverbindung für den Image-Build (npm, Docker Hub) | oder Images extern bauen und übertragen |
| Ein Reverse Proxy mit TLS (frei wählbar) | erreicht nur den Frontend-Container |
| Plattenplatz für DB-Volume + Backups | Dimensionierung offen — `REQUIRES_PRODUCTION_VERIFICATION` |
| Zielverzeichnis mit dem Repo | `git clone https://github.com/MimiRolfes/LeadsApp.git /opt/humatter-leads` |
| Ein Ort für regelmäßige, verschlüsselte Backups außerhalb des Servers | `REQUIRES_PRODUCTION_VERIFICATION` |

Es wird **keine** bestimmte Distribution, kein bestimmter Reverse Proxy und
keine vorhandene CI/CD-, Backup- oder Monitoring-Lösung vorausgesetzt.

## 2. Benötigte Docker-/Compose-Versionen

| Komponente | Anforderung | Getestet |
| --- | --- | --- |
| Docker Engine | >= 24 | `REQUIRES_PRODUCTION_VERIFICATION` |
| Docker Compose | v2 (`docker compose`, nicht `docker-compose`) | `REQUIRES_PRODUCTION_VERIFICATION` |
| Node im Build (Image-Arg `NODE_VERSION`) | 22.x LTS | 22.20.0 |
| PostgreSQL (Image) | 16.x | `postgres:16.6-bookworm` |

Runtime-Versionen sind in `compose.yaml` / den Dockerfiles gepinnt
(`postgres:16.6-bookworm`, `node:22.20.0-bookworm-slim`). Änderungen nur
bewusst und getestet.

## 3. Benötigte Ports

| Port | Service | Sichtbarkeit |
| --- | --- | --- |
| 443 (HTTPS) | Reverse Proxy | öffentlich |
| 80 | Reverse Proxy | nur HTTP→HTTPS-Redirect / ACME |
| `FRONTEND_PORT` (Default 3000) | frontend-Container, gebunden an **127.0.0.1** | nur lokal; Ziel des Reverse Proxy |
| 8080 | backend-Container | **nur** im Docker-Netz `web_net` / `backend_net` |
| 5432 | db-Container | **nur** im Docker-Netz `backend_net` (`internal: true`) |

Der Reverse Proxy muss **ausschließlich** `127.0.0.1:${FRONTEND_PORT}`
erreichen. Backend und DB dürfen **keine** veröffentlichten Ports haben —
`compose.yaml` vergibt bewusst keine. `compose.override.yaml` (lokale
Host-Ports) darf auf dem Server **nicht** vorhanden sein.

Firewall: eingehend nur 80/443 zulassen. `REQUIRES_PRODUCTION_VERIFICATION`

## 4. Environment-Variablen

Vollständige Liste mit Beschreibungen: **`.env.example`**. Auf dem Server:

```bash
cp .env.example .env
# .env mit echten Werten füllen, dann:
chmod 600 .env
```

### Pflicht (Produktion)

| Variable | Bedeutung |
| --- | --- |
| `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` | DB-Container-Init |
| `DATABASE_URL` | `postgres://<user>:<pass>@db:5432/<db>` (Host = Service-Name `db`) |
| `DATABASE_SSL` | `disable` genügt (DB nur im internen Netz); sonst `require` |
| `SESSION_SECRET` | >= 32 Zeichen Zufall: `openssl rand -base64 48` |
| `NEXT_PUBLIC_APP_NAME` | Anzeigename (unkritisch, geht an den Browser) |
| `FRONTEND_PORT` | localhost-Port für den Reverse Proxy (Default 3000) |
| `NODE_VERSION` | Build-Node-Version (Default 22.20.0) |

### Pflicht ab Phase 2

`UPLOAD_DRIVER` (+ `UPLOAD_LOCAL_DIR` oder `S3_*`), `SMTP_HOST`/`SMTP_PORT`/
`SMTP_USER`/`SMTP_PASSWORD`/`MAIL_FROM`.

### Optional (Defaults vorhanden)

`DATABASE_POOL_MAX`, `TRUST_PROXY` (in `compose.yaml` fest `true`),
`CORS_ALLOWED_ORIGINS` (leer bei Standard-Topologie),
`SESSION_IDLE_TTL_MINUTES`, `SESSION_ABSOLUTE_TTL_HOURS`,
`RATE_LIMIT_*`, `EXPORT_RETENTION_DAYS`, `SYNC_RECEIPT_RETENTION_DAYS`,
`AUDIT_RETENTION_DAYS`, `UPLOAD_MAX_BYTES`.

## 5. Secrets

- Niemals in Git, Dockerfiles, `compose.yaml`, Quellcode oder Doku.
- Nur in `.env` auf dem Server (`chmod 600`, Eigentümer = deployende(r)
  Nutzer:in) **oder** in einem Secret-Store / Docker-Secrets.
  `REQUIRES_PRODUCTION_VERIFICATION`
- `SESSION_SECRET` und DB-Passwort für Produktion **neu** erzeugen, nicht aus
  `.env.example` / lokaler Entwicklung übernehmen.
- Secrets nicht als Klartext in `docker inspect` / Prozessliste sichtbar
  machen (Compose-`environment` aus `.env` ist ok; keine `--env`-CLI-Args).

## 6. PostgreSQL-Volume (Persistenz)

- `compose.yaml` definiert das **benannte Volume `db_data`**
  (`humatter-leads_db_data`), gemountet auf
  `/var/lib/postgresql/data` im `db`-Container.
- **Daten sind vom Container-Lebenszyklus entkoppelt:**
  `docker compose down`, `docker compose up --build`, Container-Neubau und
  App-Updates **löschen die Daten nicht**.
- Datenverlust nur bei: explizitem `docker compose down -v`,
  `docker volume rm humatter-leads_db_data`, oder Ausfall des zugrunde
  liegenden Datenträgers → deshalb echtes Backup (Abschnitt 12).
- Die App führt **keine** automatischen destruktiven Resets aus. Schema nur
  über versionierte Migrationen (Abschnitt 7).
- `REQUIRES_PRODUCTION_VERIFICATION`: das Volume liegt auf einem Datenträger
  mit ausreichender Kapazität und (idealerweise) eigener Sicherung/Snapshot.

## 7. Datenbank-Migrationen

Versionierte SQL-Migrationen: `apps/backend/src/db/migrations/`.
Der `migrate`-Service in `compose.yaml` führt sie **einmalig vor dem
Backend** aus (`depends_on: migrate: condition: service_completed_successfully`).
Idempotent, niemals destruktiv — bereits angewendete Migrationen werden
übersprungen (drizzle-Journal-Tabelle).

Manuell (z. B. nach einem Update, ohne Neustart des Stacks):

```bash
docker compose run --rm migrate
```

Rollback: keine automatischen Down-Migrationen. Im Fehlerfall → Restore aus
Backup (Abschnitt 13) + vorheriges Image starten.

## 8. Container starten

```bash
cd /opt/humatter-leads          # Zielverzeichnis mit dem Repo/Compose-Projekt
cp .env.example .env            # einmalig, dann echte Werte + chmod 600
docker compose build            # reproduzierbarer Build (Versionen gepinnt)
docker compose up -d            # db -> migrate -> backend -> frontend
docker compose ps               # Status / Health prüfen
```

Danach den Reverse Proxy so konfigurieren, dass er `127.0.0.1:${FRONTEND_PORT}`
per HTTPS veröffentlicht (Abschnitt 10).

## 9. Container aktualisieren

```bash
cd /opt/humatter-leads
git pull                        # oder neue Images/Artefakte einspielen
docker compose build
docker compose run --rm migrate # Migrationen VOR dem Neustart
docker compose up -d            # rollt frontend/backend neu aus
docker compose ps
# Smoke-Test (Abschnitt 14), bei Fehler: Abschnitt 17 (Rollback)
```

Das `db_data`-Volume bleibt dabei unverändert — **kein Datenverlust**.

## 10. HTTPS / Reverse Proxy

- Die produktive App ist **ausschließlich über HTTPS** erreichbar.
- Die konkrete Lösung (nginx, Caddy, Traefik, …) ist **frei wählbar** — die
  Anwendung hat keine Abhängigkeit dazu.
- Der Reverse Proxy muss:
  - TLS terminieren (gültiges Zertifikat, Auto-Renewal) —
    `REQUIRES_PRODUCTION_VERIFICATION`
  - HTTP → HTTPS umleiten, nur TLS 1.2+
  - an **`http://127.0.0.1:${FRONTEND_PORT}`** weiterleiten (nur Frontend)
  - `X-Forwarded-Proto`/`X-Forwarded-For`/`Host` setzen und von außen
    kommende `X-Forwarded-*`-Header verwerfen
  - WebSocket/Upgrade nicht zwingend nötig (keine WS im MVP)
- Die App sendet bereits `Strict-Transport-Security`, `X-Content-Type-Options`,
  `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy`. Der Proxy
  darf ergänzen, nicht abschwächen.
- Session-Cookies (Phase 2) sind `Secure; HttpOnly; SameSite` → funktionieren
  nur über HTTPS.
- PWA / Service Worker benötigen HTTPS (sicherer Kontext).

## 11. Firewall-Anforderungen

- Eingehend: nur **80** und **443**.
- Ausgehend: Image-Build (npm/Docker Hub); ab Phase 2 SMTP und ggf.
  S3-Objektspeicher (EU).
- Docker-Ports von Backend/DB dürfen **nicht** auf externe Interfaces
  gebunden sein (in `compose.yaml` so gebaut; zusätzlich Host-Firewall).
- `REQUIRES_PRODUCTION_VERIFICATION`: tatsächliche Firewall-Regeln,
  Docker-`iptables`-Verhalten, Bindings prüfen (`ss -tlnp` von außen/innen).

## 12. Backup-Konfiguration

Details + Restore: **`docs/backup-restore.md`**.

- **Ein Docker-Volume ist kein Backup.** Zusätzlich nötig:
- Regelmäßiger logischer Dump aus dem `db`-Container:
  ```bash
  docker compose exec -T db pg_dump -U "$POSTGRES_USER" -Fc "$POSTGRES_DB" \
    > "backup_$(date +%F_%H%M).dump"
  ```
- Dump **verschlüsseln** (z. B. `age`/`gpg`), Schlüssel getrennt verwahren.
- Kopie **außerhalb des Servers** ablegen (zweiter Ort, EU/EWR).
- Retention der Backups: z. B. 7 täglich + 4 wöchentlich (mit
  `docs/retention.md` abstimmen).
- Auch die Upload-Daten sichern (ab Phase 2: `UPLOAD_LOCAL_DIR` bzw. S3).
- `.env` (Secrets) separat und verschlüsselt sichern — **nicht** im DB-Dump.
- `REQUIRES_PRODUCTION_VERIFICATION`: tatsächliche Ausführung, Zielort,
  Verschlüsselung, Aufbewahrung, Monitoring der Backup-Jobs.

## 13. Restore-Prozess

Vollständig in `docs/backup-restore.md`. Kurz:

```bash
# 1. Backend/Frontend stoppen, DB-Container behalten
docker compose stop backend frontend
# 2. Datenbank leeren + Dump einspielen
docker compose exec -T db psql -U "$POSTGRES_USER" -c \
  "DROP SCHEMA public CASCADE; CREATE SCHEMA public;" "$POSTGRES_DB"
gpg -d backup_YYYY-MM-DD_HHMM.dump.gpg | \
  docker compose exec -T db pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --no-owner
# 3. Migrationen prüfen + Stack starten
docker compose run --rm migrate
docker compose up -d
# 4. Verifizieren (Abschnitt 14)
```

**Restore mindestens einmal auf der Zielinfrastruktur testen und
protokollieren.** `REQUIRES_PRODUCTION_VERIFICATION`

Verhalten bei Server-/Volume-Ausfall: neuer Host → Repo + `.env` bereitstellen
→ `docker compose up -d` (leere DB) → `migrate` → Restore aus letztem
verschlüsseltem Off-Site-Backup. RPO/RTO siehe `docs/backup-restore.md`.

## 14. Healthchecks

| Service | Endpoint | Zweck |
| --- | --- | --- |
| frontend | `GET /healthz` | Liveness (Docker HEALTHCHECK) |
| backend | `GET /api/health` | Liveness (Docker HEALTHCHECK, intern) |
| backend | `GET /api/health/ready` | Readiness inkl. DB-Verbindung |
| db | `pg_isready` | Compose-Healthcheck |

End-to-End nach dem Deployment:

```bash
curl -fsS https://<domain>/healthz
curl -fsS https://<domain>/api/health          # via Frontend-Proxy -> Backend
curl -fsS https://<domain>/api/health/ready     # 200 = DB erreichbar
docker compose ps                               # alle "healthy"
```

## 15. Logs

- Strukturiertes JSON, **ohne PII** (keine Namen/E-Mails/Tokens/Notizen).
- `docker compose logs -f backend` / `frontend` / `db`.
- Für dauerhafte Aufbewahrung/Rotation den Docker-Logging-Treiber
  konfigurieren (z. B. `json-file` mit `max-size`/`max-file`, oder
  zentrales Logging). `REQUIRES_PRODUCTION_VERIFICATION`
- Fehlerantworten der API enthalten nie Stacktrace/SQL/Secrets.

## 16. Security-Checks nach dem Deployment

### Sofort (Smoke)

- [ ] `https://<domain>/healthz` und `/api/health` liefern `ok` über **HTTPS**
- [ ] `/api/health/ready` → 200 (DB erreichbar)
- [ ] HTTP wird auf HTTPS umgeleitet
- [ ] Response-Header enthalten HSTS, `X-Content-Type-Options`,
      `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy`
- [ ] Backend-Port (8080) von außen **nicht** erreichbar
- [ ] DB-Port (5432) von außen **und vom Host** **nicht** erreichbar
      (`docker compose exec frontend sh -c 'nc -z db 5432' ` schlägt fehl —
      Frontend ist nicht im DB-Netz)
- [ ] `compose.override.yaml` ist auf dem Server **nicht** vorhanden

### Konfiguration

- [ ] `.env`: `chmod 600`, Produktions-Secrets ≠ Entwicklung
- [ ] `SESSION_SECRET` zufällig, >= 32 Zeichen
- [ ] Container laufen als **non-root** (`docker compose exec backend id` →
      uid 1001; `frontend` → uid 1001)
- [ ] `security_opt: no-new-privileges` aktiv (in `compose.yaml`)
- [ ] Keine Secrets in `docker inspect` / `docker history`
- [ ] DB-Volume `humatter-leads_db_data` existiert und ist gemountet
- [ ] Nach `docker compose down && docker compose up -d`: Daten noch da

### Nach Phase 2 (Auth/Upload/Export)

- [ ] Login-Rate-Limit greift; Session-Cookie `Secure/HttpOnly/SameSite`
- [ ] „Von allen Geräten abmelden" invalidiert Sessions sofort
- [ ] Deaktivierter Nutzer wird sofort abgewiesen
- [ ] IDOR/BOLA auf fremdes Event/Lead/Export/Attachment → 403/404
- [ ] Upload: nur erlaubte MIME-Typen + Größenlimit
- [ ] Export separat berechtigt + `audit_log`-Eintrag
- [ ] `audit_log`: `UPDATE`/`DELETE` schlägt fehl (Trigger)

### Infrastruktur — `REQUIRES_PRODUCTION_VERIFICATION`

- [ ] TLS-Konfiguration (Protokolle/Ciphers)
- [ ] Firewall (eingehend nur 80/443), Docker-Port-Bindings
- [ ] DNS zeigt auf den richtigen Host
- [ ] Server-Hardening: SSH key-only, kein Root-Login, automatische
      Sicherheitsupdates, Zeitsync
- [ ] Docker-/OS-Patching-Prozess
- [ ] Backups laufen, verschlüsselt, off-site (EU/EWR), Restore getestet
- [ ] Monitoring/Alerting (Health, Plattenplatz, Backup-Fehler)
- [ ] Hosting-/Datenresidenz dokumentiert (Hetzner-Standort/Rechenzentrum)

## 17. Rollback bei fehlgeschlagenem Deployment

1. `docker compose logs backend frontend migrate` prüfen.
2. Wenn `migrate` fehlschlug: Ursache beheben; das Schema ist im letzten
   konsistenten Zustand (Migrationen sind transaktional pro Datei).
3. Vorherigen Stand auschecken/Image zurücksetzen:
   ```bash
   git checkout <letzter-guter-commit-oder-tag>
   docker compose build
   docker compose up -d
   ```
4. Wenn eine neue Migration Daten inkompatibel gemacht hat: DB aus dem
   Backup **vor** dem Deployment wiederherstellen (Abschnitt 13), dann das
   alte Image starten.
5. `db_data` niemals im Zuge eines Rollbacks löschen.
6. Smoke-Test (Abschnitt 14), Vorfall kurz dokumentieren.

---

## Sammelübersicht `REQUIRES_PRODUCTION_VERIFICATION`

Distribution/Docker-/Compose-Version des Servers · reale Firewall-Regeln &
Port-Bindings · TLS/HTTPS-Konfiguration · DNS · öffentlich erreichbare Ports ·
Server-Hardening & Patching · tatsächliche Backup-Ausführung + Off-Site-
Ablage + Verschlüsselung · Restore-Test auf Produktionsinfrastruktur ·
Monitoring/Alerting · Hosting-/Datenresidenz (Hetzner-Standort) ·
Secret-Management-Verfahren · Volume-Datenträger-Kapazität/-Sicherung.

Diese Punkte bestätigt der Administrator nach dem tatsächlichen Deployment.
