-- audit_log manipulationsarm machen (CLAUDE.md: Audit manipulationsarm).
--
-- Rollen-unabhängige Durchsetzung: UPDATE und DELETE auf audit_log werden
-- durch einen Trigger abgelehnt, egal mit welcher DB-Rolle. Ergänzend soll
-- der Administrator der Anwendungs-DB-Rolle nur INSERT + SELECT gewähren
-- (siehe docs/HETZNER_DEPLOYMENT.md, "Datenbank-Rolle").

CREATE OR REPLACE FUNCTION audit_log_reject_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
	RAISE EXCEPTION 'audit_log is append-only (% not allowed)', TG_OP
		USING ERRCODE = 'insufficient_privilege';
END;
$$;
--> statement-breakpoint
CREATE TRIGGER audit_log_no_update
	BEFORE UPDATE ON audit_log
	FOR EACH ROW EXECUTE FUNCTION audit_log_reject_mutation();
--> statement-breakpoint
CREATE TRIGGER audit_log_no_delete
	BEFORE DELETE ON audit_log
	FOR EACH ROW EXECUTE FUNCTION audit_log_reject_mutation();
