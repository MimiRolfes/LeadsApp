import { and, eq, gt, isNull, sql } from "drizzle-orm";
import type {
  RegisterInput,
  LoginInput,
  CurrentUser,
} from "@humatter-leads/shared";
import { adminEmails, allowedEmailDomains, env } from "../env";
import type { Db } from "../db/types";
import { passwordResetTokens, users } from "../db/schema";
import type { UserRow } from "./session";
import { revokeAllSessionsForUser } from "./session";
import { audit } from "../domain/audit";
import { hashPassword, verifyPassword } from "../lib/password";
import { generateToken, hashToken } from "../lib/tokens";
import { sendMail } from "../lib/mailer";
import { verify as verifyTotp } from "../lib/totp";
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

function writeAudit(
  db: Db,
  entry: {
    actorId?: string | null;
    action: string;
    entityId?: string | null;
    ip?: string | null;
    metadata?: Record<string, unknown>;
  },
): Promise<void> {
  return audit(db, { ...entry, entityType: "user" });
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

  // 2FA, falls für das Konto aktiv.
  if (user.totpSecret) {
    if (!input.code || !verifyTotp(user.totpSecret, input.code)) {
      await writeAudit(db, {
        actorId: user.id,
        action: "user.login_failed",
        entityId: user.id,
        ip: ctx.ip,
        metadata: { reason: "totp" },
      });
      throw errors.unauthorized(
        "totp_required",
        "Bitte den Code aus deiner Authenticator-App eingeben.",
      );
    }
  }

  await writeAudit(db, {
    actorId: user.id,
    action: "user.login",
    entityId: user.id,
    ip: ctx.ip,
  });
  return user;
}

// --- Passwort-Reset ------------------------------------------------

/**
 * Reset anfordern. Antwortet dem Aufrufer immer gleich (kein
 * User-Enumeration-Leak). Der Link wird per Mailer „versendet" (aktuell
 * Log-Treiber — siehe lib/mailer.ts).
 */
export async function requestPasswordReset(
  db: Db,
  email: string,
  ctx: { ip?: string | null } = {},
): Promise<void> {
  const rows = await db
    .select()
    .from(users)
    .where(sql`lower(${users.email}) = ${email}`)
    .limit(1);
  const user = rows[0] as UserRow | undefined;
  if (!user || user.status !== "active") return;

  const token = generateToken();
  const expiresAt = new Date(
    Date.now() + env.PASSWORD_RESET_TTL_MINUTES * 60_000,
  );
  await db.insert(passwordResetTokens).values({
    userId: user.id,
    tokenHash: await hashToken(token),
    expiresAt,
  });
  await writeAudit(db, {
    actorId: user.id,
    action: "user.password_reset_requested",
    entityId: user.id,
    ip: ctx.ip,
  });

  const link = `${env.APP_ORIGIN}/reset-password?token=${token}`;
  await sendMail({
    to: user.email,
    subject: "humatter Leads — Passwort zurücksetzen",
    text: `Zum Zurücksetzen deines Passworts diesen Link öffnen (${env.PASSWORD_RESET_TTL_MINUTES} Minuten gültig):\n\n${link}\n\nWenn du das nicht warst, ignoriere diese E-Mail.`,
  });
}

export async function resetPassword(
  db: Db,
  params: { token: string; password: string; ip?: string | null },
): Promise<void> {
  const tokenHash = await hashToken(params.token);
  const rows = await db
    .select()
    .from(passwordResetTokens)
    .where(
      and(
        eq(passwordResetTokens.tokenHash, tokenHash),
        isNull(passwordResetTokens.usedAt),
        gt(passwordResetTokens.expiresAt, new Date()),
      ),
    )
    .limit(1);
  const row = rows[0];
  if (!row) {
    throw errors.badRequest(
      "invalid_reset_token",
      "Der Link ist ungültig oder abgelaufen.",
    );
  }

  await db.transaction(async (tx) => {
    await tx
      .update(users)
      .set({ passwordHash: await hashPassword(params.password) })
      .where(eq(users.id, row.userId));
    await tx
      .update(passwordResetTokens)
      .set({ usedAt: new Date() })
      .where(eq(passwordResetTokens.id, row.id));
    await revokeAllSessionsForUser(tx, row.userId);
    await audit(tx, {
      actorId: row.userId,
      action: "user.password_reset",
      entityType: "user",
      entityId: row.userId,
      ip: params.ip,
    });
  });
}

// --- 2FA (TOTP, optional) ---------------------------------------

export async function enableTotp(
  db: Db,
  params: { userId: string; secret: string; code: string },
): Promise<void> {
  if (!verifyTotp(params.secret, params.code)) {
    throw errors.badRequest("totp_invalid", "Code stimmt nicht.");
  }
  await db
    .update(users)
    .set({ totpSecret: params.secret })
    .where(eq(users.id, params.userId));
  await audit(db, {
    actorId: params.userId,
    action: "user.2fa_enabled",
    entityType: "user",
    entityId: params.userId,
  });
}

export async function disableTotp(
  db: Db,
  params: { user: UserRow; code: string },
): Promise<void> {
  if (
    !params.user.totpSecret ||
    !verifyTotp(params.user.totpSecret, params.code)
  ) {
    throw errors.badRequest("totp_invalid", "Code stimmt nicht.");
  }
  await db
    .update(users)
    .set({ totpSecret: null })
    .where(eq(users.id, params.user.id));
  await audit(db, {
    actorId: params.user.id,
    action: "user.2fa_disabled",
    entityType: "user",
    entityId: params.user.id,
  });
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
