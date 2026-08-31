import {
  bigserial,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { exportFormat, exportStatus } from "./enums";
import { events } from "./events";
import { users } from "./identity";
import { leads } from "./leads";

/**
 * Merge-Protokoll. Der zusammengeführte Lead wird nach dem Merge gelöscht;
 * `snapshot` bewahrt seinen Zustand für Nachvollziehbarkeit/Undo-Analyse.
 */
export const leadMerges = pgTable(
  "lead_merges",
  {
    id: uuid("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    survivingLeadId: uuid("surviving_lead_id").references(() => leads.id, {
      onDelete: "set null",
    }),
    mergedLeadId: uuid("merged_lead_id"),
    performedBy: uuid("performed_by").references(() => users.id, {
      onDelete: "set null",
    }),
    snapshot: jsonb("snapshot").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("lead_merges_event_id_idx").on(t.eventId)],
);

/**
 * Export-Vorgang. Jeder Export ist separat berechtigt und wird protokolliert
 * (zusätzlich Eintrag in audit_log).
 */
export const exports = pgTable(
  "exports",
  {
    id: uuid("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    requestedBy: uuid("requested_by").references(() => users.id, {
      onDelete: "set null",
    }),
    format: exportFormat("format").notNull(),
    fieldMap: jsonb("field_map").notNull(),
    rowCount: integer("row_count"),
    status: exportStatus("status").notNull().default("pending"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (t) => [index("exports_event_id_idx").on(t.eventId)],
);

/**
 * Idempotenz-Quittungen für den Offline-Sync (ADR 0003). Ein wiederholter
 * Request mit gleichem `idempotencyKey` liefert das gespeicherte Ergebnis,
 * statt einen Datensatz doppelt anzulegen.
 */
export const syncReceipts = pgTable(
  "sync_receipts",
  {
    idempotencyKey: uuid("idempotency_key").primaryKey(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
    requestKind: text("request_kind").notNull(),
    leadId: uuid("lead_id").references(() => leads.id, {
      onDelete: "set null",
    }),
    result: jsonb("result"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("sync_receipts_user_id_idx").on(t.userId)],
);

/**
 * Manipulationsarmer Audit-Trail. Getrennt von operativen Daten.
 * Die Anwendungs-DB-Rolle erhält später nur INSERT + SELECT auf diese
 * Tabelle (siehe docs/HETZNER_DEPLOYMENT.md / Migration 0001). `actorId` NULL =
 * System-Aktion (z. B. Retention-Job).
 */
export const auditLog = pgTable(
  "audit_log",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    actorId: uuid("actor_id"),
    action: text("action").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id"),
    eventId: uuid("event_id"),
    metadata: jsonb("metadata"),
    ipHash: text("ip_hash"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("audit_log_entity_idx").on(t.entityType, t.entityId),
    index("audit_log_event_id_idx").on(t.eventId),
    index("audit_log_created_at_idx").on(t.createdAt),
  ],
);
