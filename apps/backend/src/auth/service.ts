import { and, eq, isNull, sql } from "drizzle-orm";
import type {
  RegisterInput,
  LoginInput,
  CurrentUser,
} from "@humatter-leads/shared";
import { adminEmails, allowedEmailDomains } from "../env";
import type { Db } from "../db/types";
import { auditLog, users } from "../db/schema";
import type { UserRow } from "./session";
import { hashPassword, verifyPassword } from "../lib/password";
import { hashOpaque } from "../lib/tokens";
import { errors } from "../lib/errors";

// Gültiger Argon2id-Hash eines Zufallswerts. Wird verglichen, wenn kein
// Nutzer existiert, damit die Login-Antwortzeit nicht verrät, ob die E-Mail
// bekannt ist (Timing-Oracle-Schutz). Einmalig lazy berechnet.
let dummyHashPromise: Promise<string> | undefined;
function dummyHash(): Promise<string> {
  if (!dummyHashPromise) {
    dummyHashPromise = hashPassword(
      "unused-placeholder-" + Math.random().toString(36),
    );
  }
  return dummyHashPromise;
}

export function emailDomain(email: string): string {
  return email.slice(email.lastIndexOf("@") + 1).toLowerCase();
}

export function isAllowedEmail(email: string): boolean {
  const domains = allowedEmailDomains();
  return domains.length === 0 || domains.includes(emailDomain(email));
}

export function toCurrentUser(u: UserRow): CurrentUser {
  return {
    id: u.id,
    email: u.email,
    displayName: u.displayName,
    globalRole: u.globalRole,
  };
}

async function writeAudit(
  db: Db,
  entry: {
    actorId?: string | null;
    action: string;
    entityId?: string | null;
    ip?: string | null;
    metadata?: Record<string, unknown>;
  },
): Promise<void> {
  await db.insert(auditLog).values({
    actorId: entry.actorId ?? null,
    action: entry.action,
    entityType: "user",
    entityId: entry.entityId ?? null,
    ipHash: entry.ip ? await hashOpaque(entry.ip) : null,
    metadata: entry.metadata ?? null,
  });
}

/**
 * Selbstregistrierung. Nur E-Mail-Domains aus `ALLOWED_EMAIL_DOMAINS` dürfen
 * ein Konto anlegen. Neue Konten sind sofort aktiv (Rolle "member", außer die
 * E-Mail steht in `ADMIN_EMAILS").
 */
export async function registerUser(
  db: Db,
  input: RegisterInput,
  ctx: { ip?: string | null } = {},
): Promise<UserRow> {
  const email = input.email; // bereits lowercased/getrimmt durch Zod

  if (!isAllowedEmail(email)) {
    throw errors.forbidden(
      "email_domain_not_allowed",
      `Registrierung ist nur mit einer E-Mail-Adresse folgender Domain(s) möglich: ${allowedEmailDomains().join(", ")}.`,
    );
  }

  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(sql`lower(${users.email}) = ${email}`)
    .limit(1);
  if (existing.length > 0) {
    throw errors.conflict(
      "email_taken",
      "Für diese E-Mail-Adresse existiert bereits ein Konto.",
    );
  }

  const displayName = input.displayName?.trim() || email.split("@")[0]!;
  const globalRole = adminEmails().includes(email) ? "admin" : "member";
  const passwordHash = await hashPassword(input.password);

  let user: UserRow;
  try {
    const [row] = await db
      .insert(users)
      .values({ email, passwordHash, displayName, globalRole })
      .returning();
    user = row!;
  } catch {
    // Race auf den lower(email)-Unique-Index
    throw errors.conflict(
      "email_taken",
      "Für diese E-Mail-Adresse existiert bereits ein Konto.",
    );
  }

  await writeAudit(db, {
    actorId: user.id,
    action: "user.register",
    entityId: user.id,
    ip: ctx.ip,
    metadata: { globalRole },
  });
  return user;
}

/**
 * Anmeldung. Bei falschen Zugangsdaten IMMER dieselbe generische Antwort
 * (kein Rückschluss darauf, ob die E-Mail existiert).
 */
export async function authenticateUser(
  db: Db,
  input: LoginInput,
  ctx: { ip?: string | null } = {},
): Promise<UserRow> {
  const rows = await db
    .select()
    .from(users)
    .where(sql`lower(${users.email}) = ${input.email}`)
    .limit(1);
  const user = rows[0] as UserRow | undefined;

  const ok = await verifyPassword(
    input.password,
    user?.passwordHash ?? (await dummyHash()),
  );

  if (!user || !ok || user.status !== "active") {
    await writeAudit(db, {
      actorId: user?.id ?? null,
      action: "user.login_failed",
      entityId: user?.id ?? null,
      ip: ctx.ip,
    });
    throw errors.unauthorized(
      "invalid_credentials",
      "E-Mail-Adresse oder Passwort ist falsch.",
    );
  }

  await writeAudit(db, {
    actorId: user.id,
    action: "user.login",
    entityId: user.id,
    ip: ctx.ip,
  });
  return user;
}

/** Konto deaktivieren (Admin, Phase 2 UI) — beendet auch alle Sessions. */
export async function setUserActive(
  db: Db,
  userId: string,
  active: boolean,
): Promise<void> {
  await db
    .update(users)
    .set({
      status: active ? "active" : "disabled",
      disabledAt: active ? null : new Date(),
    })
    .where(and(eq(users.id, userId), isNull(users.disabledAt)));
}
