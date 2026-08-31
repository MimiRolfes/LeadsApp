import { pgEnum } from "drizzle-orm/pg-core";

/**
 * Zentrale Enum-Definitionen. Reihenfolge der Werte ist stabil zu halten
 * (Postgres-Enums sind ordinal); neue Werte nur anhängen.
 */

export const userStatus = pgEnum("user_status", ["active", "disabled"]);

/**
 * Plattformweite Rolle. "admin" = voller Zugriff (Benutzer, alle Events,
 * Retention, Integrationen). "member" = Rechte ergeben sich aus der
 * Event-Mitgliedschaft (event_members.event_role).
 */
export const globalRole = pgEnum("global_role", ["admin", "member"]);

/** Rolle innerhalb eines Events (PROJECT.md Nutzerrollen). */
export const eventRole = pgEnum("event_role", [
  "manager",
  "member",
  "readonly",
]);

export const eventStatus = pgEnum("event_status", [
  "draft",
  "active",
  "closed",
]);

export const questionType = pgEnum("question_type", [
  "text",
  "textarea",
  "single_select",
  "multi_select",
  "boolean",
  "number",
]);

export const leadPriority = pgEnum("lead_priority", ["hot", "warm", "cold"]);

/**
 * Rechtsgrundlage der Verarbeitung — bewusst getrennt vom Lead-Score
 * (CLAUDE.md Datenschutz-Regeln).
 */
export const legalBasis = pgEnum("legal_basis", [
  "not_set",
  "consent",
  "legitimate_interest",
  "contract",
]);

export const consentStatus = pgEnum("consent_status", [
  "not_asked",
  "granted",
  "denied",
]);

export const followupStatus = pgEnum("followup_status", [
  "open",
  "done",
  "cancelled",
]);

export const scanStatus = pgEnum("scan_status", [
  "pending",
  "clean",
  "infected",
  "error",
]);

export const exportFormat = pgEnum("export_format", ["csv", "xlsx", "json"]);

export const exportStatus = pgEnum("export_status", [
  "pending",
  "completed",
  "failed",
]);

/** Was bei Ablauf der Retention-Frist mit einem Lead geschieht. */
export const retentionMode = pgEnum("retention_mode", [
  "anonymize",
  "hard_delete",
]);
