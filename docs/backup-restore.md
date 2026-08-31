# docs/backup-restore.md — humatter Leads

Status: Phase 1 (Verfahren + lokal übbarer Restore-Weg). Produktive Backup-
Infrastruktur auf dem Hetzner-Server: **REQUIRES_PRODUCTION_VERIFICATION**.
Datum: 2026-08-31 · Architektur: ADR 0004.

> **Ein Docker-Volume ist kein Backup.** Das benannte Volume `db_data`
> schützt vor Container-Neustart/-Rebuild, nicht vor Datenträgerausfall,
> Fehlbedienung (`down -v`), Ransomware oder Rechenzentrumsverlust.

## Was gesichert werden muss

| Speicher | Inhalt | Klasse |
| --- | --- | --- |
| PostgreSQL (`db_data`) | alle operativen Daten + `audit_log` | hoch (Massen-PII) |
| Upload-Speicher (ab Phase 2) | Visitenkarten-Fotos/Scans (`UPLOAD_LOCAL_DIR` oder S3) | hoch (PII) |
| `.env` auf dem Server | Secrets | hoch — **getrennt** und verschlüsselt, NICHT im DB-Dump |

Der lokale Offline-Store der PWA wird **nicht** gesichert (nur temporärer
Zwischenspeicher, ADR 0003/0004).

## PostgreSQL — Backup (Docker)

Logischer Dump aus dem laufenden `db`-Container, komprimiert (custom format):

```bash
cd /opt/humatter-leads
set -a; . ./.env; set +a
docker compose exec -T db pg_dump -U "$POSTGRES_USER" -Fc --no-owner \
  --no-privileges "$POSTGRES_DB" > "backup_$(date +%F_%H%M).dump"
```

- **Automatisieren** (Cron/systemd-Timer/Job-Runner — frei wählbar), z. B.
  täglich; an Messetagen häufiger (viele Leads entstehen).
- **Verschlüsseln** vor Ablage:
  ```bash
  age -r <recipient> -o backup.dump.age backup.dump    # oder gpg -e
  ```
  Schlüssel/Passphrase getrennt vom Backup verwahren.
- **Off-Site**: Kopie an einen zweiten Ort (anderes System / EU-Objekt-
  speicher). Nie ausschließlich auf demselben Server.
- **Retention** der Backups: z. B. 7 täglich + 4 wöchentlich + 3 monatlich
  (mit `docs/retention.md` abstimmen).
- `REQUIRES_PRODUCTION_VERIFICATION`: tatsächlicher Zeitplan, Zielort,
  Verschlüsselung, Aufbewahrung, Job-Monitoring.

## PostgreSQL — Restore (Docker)

```bash
cd /opt/humatter-leads
set -a; . ./.env; set +a

# 1. App-Container stoppen, db-Container weiterlaufen lassen
docker compose stop backend frontend

# 2. Schema leeren
docker compose exec -T db psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" \
  -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"

# 3. Dump einspielen (ggf. vorher entschlüsseln)
age -d -i <key> backup.dump.age | \
  docker compose exec -T db pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" \
    --no-owner --no-privileges

# 4. Migrationen prüfen (sollte "up to date" melden) + Stack starten
docker compose run --rm migrate
docker compose up -d
```

### Nach dem Restore verifizieren

- [ ] Tabellen-/Zeilenzahlen plausibel
- [ ] `audit_log`-Trigger aktiv: `UPDATE audit_log SET action='x'` schlägt fehl
- [ ] `curl -fsS https://<domain>/api/health/ready` → 200
- [ ] `docker compose ps` → alle `healthy`
- [ ] Login eines Testkontos + ein Lead sichtbar (ab Phase 2)

## Upload-Speicher — Backup/Restore (ab Phase 2)

- `local`-Treiber: `UPLOAD_LOCAL_DIR` liegt idealerweise in einem eigenen
  benannten Volume; mit `docker run --rm -v humatter-leads_uploads:/data
  -v $PWD:/backup alpine tar czf /backup/uploads.tgz -C /data .` sichern,
  verschlüsseln, off-site. Restore = Archiv zurückspielen.
- `s3`-Treiber: Bucket-Versionierung + Lifecycle bzw. Cross-Region-Kopie (EU).
  `REQUIRES_PRODUCTION_VERIFICATION`

## Lokaler Übungs-Restore (jetzt, ohne Server)

```bash
cp .env.example .env && cp compose.override.yaml.example compose.override.yaml
docker compose up -d db
docker compose run --rm migrate
docker compose exec -T db psql -U leads -d leads -c "select count(*) from users;"
# Dump ziehen
docker compose exec -T db pg_dump -U leads -Fc leads > local.dump
# Volume zerstören und aus Dump wiederherstellen
docker compose down -v
docker compose up -d db
cat local.dump | docker compose exec -T db pg_restore -U leads -d leads --no-owner
```

## Verhalten bei Server-/Volume-Ausfall

1. Neuen Host bereitstellen (Docker + Compose).
2. Repo/Compose-Projekt + `.env` (aus dem verschlüsselten Secret-Backup)
   einspielen.
3. `docker compose up -d` → leere DB → `docker compose run --rm migrate`.
4. Letztes verschlüsseltes Off-Site-Backup einspielen (Restore oben).
5. Upload-Speicher wiederherstellen.
6. Reverse Proxy / DNS auf den neuen Host zeigen lassen.
7. Verifizieren (Checkliste oben) + Vorfall dokumentieren.

## RPO / RTO (Vorschlag — durch Auftraggeberin/Admin zu bestätigen)

- **RPO** (max. Datenverlust): 24 h; an Messetagen 1–4 h (häufigere Dumps).
- **RTO** (max. Ausfalldauer): 4 h.

## REQUIRES_PRODUCTION_VERIFICATION

- Tatsächlicher Backup-Zeitplan, -Ausführung und -Zielort
- Verschlüsselung at rest + in transit der Backups
- Off-Site-Ziel liegt in der EU/EWR
- **Restore-Test auf der echten Hetzner-Infrastruktur** (mind. einmal,
  protokolliert)
- Monitoring/Alerting bei fehlgeschlagenem Backup
- Datenträger-/Volume-Kapazität und ggf. Snapshot-Ebene des Providers
- Aufbewahrungsfristen der Backups final festgelegt
