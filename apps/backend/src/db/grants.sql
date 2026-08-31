-- Least-Privilege-Rechte für die Anwendungs-DB-Rolle.
--
-- NACH der ersten Migration ausführen, mit einer administrativen DB-Verbindung.
-- Ersetze <app_role> durch den Rollennamen aus DATABASE_URL (z. B.
-- humatter_leads_app). Der Retention-Job braucht eine getrennte Rolle mit
-- DELETE-Rechten (siehe unten).
--
-- Idempotent — kann nach jeder Migration erneut ausgeführt werden.

\set app_role humatter_leads_app

GRANT USAGE ON SCHEMA public TO :"app_role";

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public
  TO :"app_role";
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO :"app_role";

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO :"app_role";
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO :"app_role";

-- audit_log ist append-only: der App-Rolle nur INSERT + SELECT.
-- (Zusätzlich verhindert Migration 0001 UPDATE/DELETE rollenunabhängig.)
REVOKE UPDATE, DELETE, TRUNCATE ON audit_log FROM :"app_role";

-- Kein Schema-DDL zur Laufzeit.
REVOKE CREATE ON SCHEMA public FROM :"app_role";

-- Optional: getrennte Rolle für den Retention-Job (DELETE auf operativen
-- Tabellen, aber ebenfalls kein audit_log-UPDATE/DELETE):
-- CREATE ROLE humatter_leads_retention LOGIN PASSWORD '<geheim>';
-- GRANT USAGE ON SCHEMA public TO humatter_leads_retention;
-- GRANT SELECT, DELETE, UPDATE ON leads, lead_notes, lead_answers, lead_tags,
--   followups, attachments, lead_merges, sessions, password_reset_tokens
--   TO humatter_leads_retention;
-- GRANT INSERT, SELECT ON audit_log TO humatter_leads_retention;
