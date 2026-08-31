import { and, eq, gt, isNull, lt, ne } from "drizzle-orm";
import { env } from "../env";
import type { Db } from "../db/types";
import { sessions, users } from "../db/schema";
import { generateToken, hashOpaque, hashToken } from "../lib/tokens";

export type SessionRow = typeof sessions.$inferSelect;
export type UserRow = typeof users.$inferSelect;

function absoluteExpiry(from: Date): Date {
  return new Date(from.getTime() + env.SESSION_ABSOLUTE_TTL_HOURS * 3600_000);
}

/**
 * Neue Session anlegen. Gibt das Klartext-Token zurück (nur hier verfügbar);
 * gespeichert wird ausschließlich dessen Hash.
 */
export async function createSession(
  db: Db,
  params: { userId: string; ip?: string | null; userAgent?: string | null },
): Promise<{ token: string; session: SessionRow }> {
  const token = generateToken();
  const now = new Date();
  const [session] = await db
    .insert(sessions)
    .values({
      userId: params.userId,
      tokenHash: await hashToken(token),
      createdAt: now,
      lastUsedAt: now,
      expiresAt: absoluteExpiry(now),
      ipHash: params.ip ? await hashOpaque(params.ip) : null,
      userAgentHash: params.userAgent
        ? await hashOpaque(params.userAgent)
        : null,
    })
    .returning();
  return { token, session: session! };
}

/**
 * Session anhand des Klartext-Tokens prüfen. Berücksichtigt Revocation,
 * Absolut- und Idle-Timeout sowie den Kontostatus. Erneuert `lastUsedAt`
 * (sliding window). Gibt `null` bei jedem Fehlschlag.
 */
export async function validateSession(
  db: Db,
  token: string,
): Promise<{ session: SessionRow; user: UserRow } | null> {
  if (!token) return null;
  const tokenHash = await hashToken(token);
  const now = new Date();

  const rows = await db
    .select({ session: sessions, user: users })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(
      and(
        eq(sessions.tokenHash, tokenHash),
        isNull(sessions.revokedAt),
        gt(sessions.expiresAt, now),
      ),
    )
    .limit(1);

  const row = rows[0];
  if (!row) return null;

  const idleMs = env.SESSION_IDLE_TTL_MINUTES * 60_000;
  if (now.getTime() - row.session.lastUsedAt.getTime() > idleMs) {
    await db
      .update(sessions)
      .set({ revokedAt: now })
      .where(eq(sessions.id, row.session.id));
    return null;
  }

  if (row.user.status !== "active") {
    await revokeAllSessionsForUser(db, row.user.id);
    return null;
  }

  await db
    .update(sessions)
    .set({ lastUsedAt: now })
    .where(eq(sessions.id, row.session.id));

  return { session: { ...row.session, lastUsedAt: now }, user: row.user };
}

export async function revokeSession(db: Db, sessionId: string): Promise<void> {
  await db
    .update(sessions)
    .set({ revokedAt: new Date() })
    .where(and(eq(sessions.id, sessionId), isNull(sessions.revokedAt)));
}

/** Alle (aktiven) Sessions eines Nutzers beenden — „von allen Geräten abmelden". */
export async function revokeAllSessionsForUser(
  db: Db,
  userId: string,
  exceptSessionId?: string,
): Promise<void> {
  const conditions = [eq(sessions.userId, userId), isNull(sessions.revokedAt)];
  if (exceptSessionId) conditions.push(ne(sessions.id, exceptSessionId));
  await db
    .update(sessions)
    .set({ revokedAt: new Date() })
    .where(and(...conditions));
}

/** Aufräum-Helfer (Retention): abgelaufene/zurückgezogene Sessions löschen. */
export async function purgeExpiredSessions(db: Db): Promise<void> {
  await db.delete(sessions).where(lt(sessions.expiresAt, new Date()));
}
