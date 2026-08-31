import type { Db } from "../db/types";
import { auditLog } from "../db/schema";
import { hashOpaque } from "../lib/tokens";

/**
 * Einheitlicher Audit-Schreiber. Bewusst minimal: keine vollständige PII in
 * `metadata` (keine Namen/E-Mails/Notizen). `audit_log` ist append-only
 * (Trigger + Grants).
 */
export async function audit(
  db: Db,
  entry: {
    actorId?: string | null;
    action: string;
    entityType: string;
    entityId?: string | null;
    eventId?: string | null;
    ip?: string | null;
    metadata?: Record<string, unknown>;
  },
): Promise<void> {
  await db.insert(auditLog).values({
    actorId: entry.actorId ?? null,
    action: entry.action,
    entityType: entry.entityType,
    entityId: entry.entityId ?? null,
    eventId: entry.eventId ?? null,
    ipHash: entry.ip ? await hashOpaque(entry.ip) : null,
    metadata: entry.metadata ?? null,
  });
}
