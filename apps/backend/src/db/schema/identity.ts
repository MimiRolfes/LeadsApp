import { sql } from "drizzle-orm";
import {
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { globalRole, userStatus } from "./enums";

const now = () => new Date();

/**
 * Benutzerkonten. E-Mail wird in der Anwendung immer klein geschrieben;
 * Eindeutigkeit über einen funktionalen Index auf lower(email), damit keine
 * DB-Extension (citext) nötig ist — maximale Portabilität (Docker-Postgres lokal wie in Produktion).
 */
export const users = pgTable(
  "users",
  {
    id: uuid("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    email: text("email").notNull(),
    passwordHash: text("password_hash").notNull(),
    displayName: text("display_name").notNull(),
    status: userStatus("status").notNull().default("active"),
    globalRole: globalRole("global_role").notNull().default("member"),
    totpSecret: text("totp_secret"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(now),
    disabledAt: timestamp("disabled_at", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("users_email_lower_key").on(sql`lower(${t.email})`),
    index("users_status_idx").on(t.status),
  ],
);

/**
 * Serverseitiger Session-Store. Ermöglicht "von allen Geräten abmelden"
 * (alle Sessions revoken) und sofortige Invalidierung bei Deaktivierung.
 * Es wird nur der Hash des Session-Tokens gespeichert.
 */
export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    // gehashte Metadaten (keine Klartext-IP / kein Klartext-User-Agent)
    ipHash: text("ip_hash"),
    userAgentHash: text("user_agent_hash"),
  },
  (t) => [
    uniqueIndex("sessions_token_hash_key").on(t.tokenHash),
    index("sessions_user_id_idx").on(t.userId),
    index("sessions_expires_at_idx").on(t.expiresAt),
  ],
);

/**
 * Einmal verwendbare Passwort-Reset-Token (Hash, kurze Gültigkeit).
 */
export const passwordResetTokens = pgTable(
  "password_reset_tokens",
  {
    id: uuid("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("password_reset_tokens_token_hash_key").on(t.tokenHash),
    index("password_reset_tokens_user_id_idx").on(t.userId),
  ],
);
