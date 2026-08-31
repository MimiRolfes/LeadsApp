import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { env, uploadAutoApprove } from "../env";
import type { Db } from "../db/types";
import { attachments, leads } from "../db/schema";
import { errors } from "../lib/errors";
import { extensionFor, sniffMime } from "../lib/filetype";
import { deleteObject, getObject, putObject } from "../lib/storage";
import { audit } from "./audit";

export type AttachmentRow = typeof attachments.$inferSelect;

export async function createAttachment(
  db: Db,
  params: {
    actorId: string;
    leadId: string;
    eventId: string;
    bytes: Uint8Array;
    originalFilename?: string;
  },
): Promise<AttachmentRow> {
  if (params.bytes.byteLength === 0) {
    throw errors.badRequest("empty_file");
  }
  if (params.bytes.byteLength > env.UPLOAD_MAX_BYTES) {
    throw errors.badRequest(
      "file_too_large",
      `Maximal ${Math.round(env.UPLOAD_MAX_BYTES / 1024 / 1024)} MB.`,
    );
  }
  const mime = sniffMime(params.bytes);
  if (!mime) {
    throw errors.badRequest(
      "unsupported_file_type",
      "Erlaubt sind JPEG, PNG, WebP und PDF.",
    );
  }

  const storageKey = `${new Date().getUTCFullYear()}/${randomUUID()}.${extensionFor(mime)}`;
  await putObject(storageKey, params.bytes);

  const [row] = await db
    .insert(attachments)
    .values({
      leadId: params.leadId,
      storageKey,
      originalFilename: params.originalFilename?.slice(0, 255) ?? null,
      mimeType: mime,
      byteSize: params.bytes.byteLength,
      scanStatus: uploadAutoApprove() ? "clean" : "pending",
      createdBy: params.actorId,
    })
    .returning();

  await audit(db, {
    actorId: params.actorId,
    action: "attachment.upload",
    entityType: "attachment",
    entityId: row!.id,
    eventId: params.eventId,
    metadata: { mime, bytes: params.bytes.byteLength },
  });
  return row!;
}

export async function listLeadAttachments(
  db: Db,
  leadId: string,
): Promise<AttachmentRow[]> {
  return db.select().from(attachments).where(eq(attachments.leadId, leadId));
}

/** Referenz für die Autorisierung (Event + Lead-Owner des Anhangs). */
export async function getAttachmentContext(db: Db, attachmentId: string) {
  const rows = await db
    .select({
      attachment: attachments,
      eventId: leads.eventId,
      ownerId: leads.ownerId,
    })
    .from(attachments)
    .innerJoin(leads, eq(leads.id, attachments.leadId))
    .where(eq(attachments.id, attachmentId))
    .limit(1);
  return rows[0] ?? null;
}

export async function readAttachmentBytes(
  attachment: AttachmentRow,
): Promise<Uint8Array> {
  if (attachment.scanStatus !== "clean") {
    throw errors.forbidden(
      "attachment_not_ready",
      "Der Anhang ist noch nicht freigegeben.",
    );
  }
  return getObject(attachment.storageKey);
}

export async function deleteAttachment(
  db: Db,
  params: { actorId: string; attachmentId: string; eventId: string },
): Promise<void> {
  const [row] = await db
    .delete(attachments)
    .where(eq(attachments.id, params.attachmentId))
    .returning();
  if (!row) throw errors.notFound("attachment_not_found");
  await deleteObject(row.storageKey);
  await audit(db, {
    actorId: params.actorId,
    action: "attachment.delete",
    entityType: "attachment",
    entityId: params.attachmentId,
    eventId: params.eventId,
  });
}
