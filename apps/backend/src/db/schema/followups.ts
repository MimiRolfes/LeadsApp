import {
  date,
  index,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { followupStatus } from "./enums";
import { events } from "./events";
import { users } from "./identity";
import { leads } from "./leads";

/** Wiederverwendbare Textbausteine für Follow-ups, pro Event. */
export const followupTemplates = pgTable("followup_templates", {
  id: uuid("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  eventId: uuid("event_id")
    .notNull()
    .references(() => events.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  body: text("body").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/**
 * Follow-up-Aufgabe zu einem Lead. `status` + `dueOn` ergeben
 * offen / erledigt / überfällig in der UI. Kein automatischer Versand.
 */
export const followups = pgTable(
  "followups",
  {
    id: uuid("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    leadId: uuid("lead_id")
      .notNull()
      .references(() => leads.id, { onDelete: "cascade" }),
    assigneeId: uuid("assignee_id").references(() => users.id, {
      onDelete: "set null",
    }),
    dueOn: date("due_on"),
    status: followupStatus("status").notNull().default("open"),
    note: text("note"),
    templateId: uuid("template_id").references(() => followupTemplates.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (t) => [
    index("followups_lead_id_idx").on(t.leadId),
    index("followups_assignee_status_idx").on(t.assigneeId, t.status),
    index("followups_due_on_idx").on(t.dueOn),
  ],
);
