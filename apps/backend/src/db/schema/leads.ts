import { sql } from "drizzle-orm";
import {
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { consentStatus, leadPriority, legalBasis, scanStatus } from "./enums";
import { events, questions } from "./events";
import { users } from "./identity";

const now = () => new Date();

/**
 * Lead = am Stand erfasster Kontakt + Qualifizierung.
 *
 * - `clientLocalId`: vom Client vor dem ersten Speichern erzeugt; zugleich
 *   Idempotency-Key beim Sync (ADR 0003). Eindeutig pro Event.
 * - `version`: optimistische Sperre für die Konfliktbehandlung.
 * - PII-Spalten sind in docs/data-model.md klassifiziert. Keine Art.-9-Felder.
 * - `legalBasis` / `consentStatus` sind bewusst vom `leadScore` getrennt.
 */
export const leads = pgTable(
  "leads",
  {
    id: uuid("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    ownerId: uuid("owner_id").references(() => users.id, {
      onDelete: "set null",
    }),
    clientLocalId: uuid("client_local_id").notNull(),

    // --- Kontaktdaten (B2B) ---
    firstName: text("first_name"),
    lastName: text("last_name"),
    company: text("company"),
    position: text("position"),
    email: text("email"),
    phone: text("phone"),
    website: text("website"),
    linkedin: text("linkedin"),
    country: text("country"),
    language: text("language"),
    source: text("source"),

    // --- Qualifizierung ---
    priority: leadPriority("priority"),
    leadScore: integer("lead_score"),
    legalBasis: legalBasis("legal_basis").notNull().default("not_set"),
    consentStatus: consentStatus("consent_status")
      .notNull()
      .default("not_asked"),
    consentRecordedAt: timestamp("consent_recorded_at", { withTimezone: true }),

    // --- System ---
    version: integer("version").notNull().default(1),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(now),
    // Erst-Sync-Bestätigung vom Server
    syncedAt: timestamp("synced_at", { withTimezone: true }),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    anonymizedAt: timestamp("anonymized_at", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("leads_event_client_local_id_key").on(
      t.eventId,
      t.clientLocalId,
    ),
    index("leads_event_id_idx").on(t.eventId),
    index("leads_owner_id_idx").on(t.ownerId),
    index("leads_priority_idx").on(t.eventId, t.priority),
    // Duplikatsuche über E-Mail (nur aktive Leads)
    index("leads_event_email_lower_idx")
      .on(t.eventId, sql`lower(${t.email})`)
      .where(sql`${t.email} is not null and ${t.deletedAt} is null`),
  ],
);

/** Antworten auf den Event-Fragenkatalog. Eine Antwort pro Frage/Lead. */
export const leadAnswers = pgTable(
  "lead_answers",
  {
    id: uuid("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    leadId: uuid("lead_id")
      .notNull()
      .references(() => leads.id, { onDelete: "cascade" }),
    questionId: uuid("question_id")
      .notNull()
      .references(() => questions.id, { onDelete: "cascade" }),
    value: jsonb("value"),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(now),
  },
  (t) => [
    uniqueIndex("lead_answers_lead_question_key").on(t.leadId, t.questionId),
  ],
);

/** Freitext-Gesprächsnotizen. Additiv (Sync merged per Union, ADR 0003). */
export const leadNotes = pgTable(
  "lead_notes",
  {
    id: uuid("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    leadId: uuid("lead_id")
      .notNull()
      .references(() => leads.id, { onDelete: "cascade" }),
    authorId: uuid("author_id").references(() => users.id, {
      onDelete: "set null",
    }),
    body: text("body").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("lead_notes_lead_id_idx").on(t.leadId)],
);

/** Interessen-Tags, pro Event definiert. */
export const tags = pgTable(
  "tags",
  {
    id: uuid("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    label: text("label").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("tags_event_label_lower_key").on(
      t.eventId,
      sql`lower(${t.label})`,
    ),
  ],
);

export const leadTags = pgTable(
  "lead_tags",
  {
    leadId: uuid("lead_id")
      .notNull()
      .references(() => leads.id, { onDelete: "cascade" }),
    tagId: uuid("tag_id")
      .notNull()
      .references(() => tags.id, { onDelete: "cascade" }),
  },
  (t) => [
    primaryKey({ columns: [t.leadId, t.tagId] }),
    index("lead_tags_tag_id_idx").on(t.tagId),
  ],
);

/**
 * Datei-Anhänge (Visitenkarten-Fotos/Scans). Nur Metadaten in der DB; die
 * Datei liegt im Objektspeicher (Treiber per ENV). `scanStatus` steuert den
 * Zugriff (nur "clean" ausliefern).
 */
export const attachments = pgTable(
  "attachments",
  {
    id: uuid("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    leadId: uuid("lead_id")
      .notNull()
      .references(() => leads.id, { onDelete: "cascade" }),
    storageKey: text("storage_key").notNull(),
    originalFilename: text("original_filename"),
    mimeType: text("mime_type").notNull(),
    byteSize: integer("byte_size").notNull(),
    scanStatus: scanStatus("scan_status").notNull().default("pending"),
    createdBy: uuid("created_by").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("attachments_storage_key_key").on(t.storageKey),
    index("attachments_lead_id_idx").on(t.leadId),
  ],
);
