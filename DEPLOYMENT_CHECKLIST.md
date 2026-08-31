# DEPLOYMENT_CHECKLIST.md — humatter Leads

Schritt-für-Schritt-Kurzanleitung für ein Deployment auf den Hetzner-Server.
Ausführliche Erläuterungen: [`docs/HETZNER_DEPLOYMENT.md`](docs/HETZNER_DEPLOYMENT.md).

## Vorbereitung (einmalig)

- [ ] Docker Engine (>= 24) + Docker Compose v2 auf dem Server installiert
- [ ] Repository ausgecheckt:
      `git clone https://github.com/MimiRolfes/LeadsApp.git /opt/humatter-leads`
- [ ] `compose.override.yaml` ist **nicht** vorhanden (nur lokal!)
- [ ] `cp .env.example .env`
- [ ] `.env` mit echten Produktionswerten gefüllt:
  - [ ] `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB`
  - [ ] `DATABASE_URL` = `postgres://<user>:<pass>@db:5432/<db>`
  - [ ] `SESSION_SECRET` = `openssl rand -base64 48` (neu erzeugt)
  - [ ] `FRONTEND_PORT` (Default 3000), `NODE_VERSION` (Default 22.20.0)
  - [ ] `NEXT_PUBLIC_APP_NAME`
- [ ] `chmod 600 .env`
- [ ] Reverse Proxy vorbereitet (TLS-Zertifikat, Weiterleitung an
      `127.0.0.1:${FRONTEND_PORT}`)
- [ ] Host-Firewall: eingehend nur 80/443

## Erst-Deployment

- [ ] `docker compose build`
- [ ] `docker compose up -d`
- [ ] `docker compose ps` → alle Services `healthy`
- [ ] `docker compose logs migrate` → „Migrations up to date."
- [ ] Reverse Proxy aktivieren (HTTPS)
- [ ] Smoke-Test:
  - [ ] `curl -fsS https://<domain>/healthz`
  - [ ] `curl -fsS https://<domain>/api/health`
  - [ ] `curl -fsS https://<domain>/api/health/ready` → 200
- [ ] Security-Checks „Sofort" + „Konfiguration" aus
      `docs/HETZNER_DEPLOYMENT.md` §16 abgehakt
- [ ] Backup-Job eingerichtet (`docs/backup-restore.md`)
- [ ] **Restore einmal getestet** und protokolliert
- [ ] `REQUIRES_PRODUCTION_VERIFICATION`-Punkte durchgegangen (§16)

## Update-Deployment

- [ ] Backup **vor** dem Update erstellt (`pg_dump`, verschlüsselt, off-site)
- [ ] `git pull` (oder neues Artefakt)
- [ ] `docker compose build`
- [ ] `docker compose run --rm migrate`
- [ ] `docker compose up -d`
- [ ] `docker compose ps` → `healthy`
- [ ] Smoke-Test (siehe oben)
- [ ] Kurzer Funktionstest: Login + ein Test-Lead (offline → sync) [ab Phase 2]

## Bei Fehlschlag → Rollback

- [ ] `docker compose logs backend frontend migrate` gesichtet
- [ ] `git checkout <letzter-guter-stand>` → `docker compose build` →
      `docker compose up -d`
- [ ] Falls Migration Daten inkompatibel: DB aus Vor-Update-Backup
      wiederherstellen (`docs/backup-restore.md`), dann altes Image starten
- [ ] `db_data`-Volume **nicht** gelöscht
- [ ] Vorfall dokumentiert

## Regelmäßig (Betrieb)

- [ ] Backups laufen und werden off-site verschlüsselt abgelegt
- [ ] Restore periodisch testen
- [ ] Docker-/OS-Sicherheitsupdates
- [ ] Plattenplatz des DB-Volumes überwachen
- [ ] `docker compose logs` / Monitoring auf Fehler prüfen
