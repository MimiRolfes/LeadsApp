/**
 * App-weite Konstanten (client + server importierbar, keine Secrets).
 */
export const APP_NAME = "humatter Leads";

export const LOCALES = ["de"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "de";

/**
 * Plattformweite Rolle. "admin" = voller Zugriff; "member" = Rechte ergeben
 * sich aus der Event-Mitgliedschaft. Muss zum DB-Enum `global_role` passen.
 */
export const GLOBAL_ROLES = ["admin", "member"] as const;
export type GlobalRole = (typeof GLOBAL_ROLES)[number];

/** Rolle innerhalb eines Events (PROJECT.md). DB-Enum `event_role`. */
export const EVENT_ROLES = ["manager", "member", "readonly"] as const;
export type EventRole = (typeof EVENT_ROLES)[number];

/** Event-Status. Muss zum DB-Enum `event_status` passen. */
export const EVENT_STATUSES = ["draft", "active", "closed"] as const;
export type EventStatus = (typeof EVENT_STATUSES)[number];

/** Fragetypen des konfigurierbaren Gesprächskatalogs. DB-Enum `question_type`. */
export const QUESTION_TYPES = [
  "text",
  "textarea",
  "single_select",
  "multi_select",
  "boolean",
  "number",
] as const;
export type QuestionType = (typeof QUESTION_TYPES)[number];

/** Lead-Priorität laut PROJECT.md / MASTER_PROMPT §2D. */
export const LEAD_PRIORITIES = ["hot", "warm", "cold"] as const;
export type LeadPriority = (typeof LEAD_PRIORITIES)[number];

/** Rechtsgrundlage — getrennt vom Lead-Score. DB-Enum `legal_basis`. */
export const LEGAL_BASES = [
  "not_set",
  "consent",
  "legitimate_interest",
  "contract",
] as const;
export type LegalBasis = (typeof LEGAL_BASES)[number];

/** Einwilligungsstatus. DB-Enum `consent_status`. */
export const CONSENT_STATUSES = ["not_asked", "granted", "denied"] as const;
export type ConsentStatus = (typeof CONSENT_STATUSES)[number];

/** Follow-up-Status. DB-Enum `followup_status`. */
export const FOLLOWUP_STATUSES = ["open", "done", "cancelled"] as const;
export type FollowupStatus = (typeof FOLLOWUP_STATUSES)[number];

/** Sichtbare Sync-Zustände laut CLAUDE.md Offline-Regeln. */
export const SYNC_STATES = [
  "offline",
  "pending",
  "syncing",
  "failed",
  "synced",
] as const;
export type SyncState = (typeof SYNC_STATES)[number];
