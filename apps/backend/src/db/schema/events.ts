import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { eventRole, eventStatus, questionType, retentionMode } from "./enums";
import { users } from "./identity";

const now = () => new Date();

/**
 * Messe-/Event. Isolationsgrenze für alle operativen Daten (ADR 0002).
 * Retention-Regeln sind pro Event konfigurierbar (docs/retention.md).
 */
export const events = pgTable(
  "events",
  {
    id: uuid("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    name: text("name").notNull(),
    location: text("location"),
    startsOn: date("starts_on"),
    endsOn: date("ends_on"),
    status: eventStatus("status").notNull().default("draft"),
    // Frist in Tagen nach ends_on; NULL = keine automatische Bereinigung
    retentionDays: integer("retention_days"),
    retentionMode: retentionMode("retention_mode")
      .notNull()
      .default("anonymize"),
    createdBy: uuid("created_by").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(now),
  },
  (t) => [index("events_status_idx").on(t.status)],
);

/**
 * Team-Zuweisung + Event-Rolle. Zusammengesetzter PK erzwingt eine
 * Mitgliedschaft pro Nutzer/Event.
 */
export const eventMembers = pgTable(
  "event_members",
  {
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    eventRole: eventRole("event_role").notNull().default("member"),
    addedAt: timestamp("added_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.eventId, t.userId] }),
    index("event_members_user_id_idx").on(t.userId),
  ],
);

/**
 * Konfigurierbarer Fragenkatalog pro Event. `options` nur für
 * single_select / multi_select (Array von { value, label }).
 */
export const questions = pgTable(
  "questions",
  {
    id: uuid("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    prompt: text("prompt").notNull(),
    type: questionType("type").notNull(),
    options: jsonb("options"),
    position: integer("position").notNull().default(0),
    required: boolean("required").notNull().default(false),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("questions_event_id_position_idx").on(t.eventId, t.position)],
);
