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

/** Lead-Priorität laut PROJECT.md / MASTER_PROMPT §2D. */
export const LEAD_PRIORITIES = ["hot", "warm", "cold"] as const;
export type LeadPriority = (typeof LEAD_PRIORITIES)[number];

/** Sichtbare Sync-Zustände laut CLAUDE.md Offline-Regeln. */
export const SYNC_STATES = [
  "offline",
  "pending",
  "syncing",
  "failed",
  "synced",
] as const;
export type SyncState = (typeof SYNC_STATES)[number];
