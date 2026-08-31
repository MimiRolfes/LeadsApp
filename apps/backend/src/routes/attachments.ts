import { Hono, type Context } from "hono";
import type { AppEnv } from "../types";
import { requireAuthz } from "../auth/middleware";
import { assertCanEditLead, assertCanViewLead } from "../authz";
import {
  deleteAttachment,
  getAttachmentContext,
  readAttachmentBytes,
} from "../domain/attachments";
import { errors } from "../lib/errors";

/** Anhang-Zugriff (by id). Upload/Liste liegt lead-gescopt (routes/leads.ts). */
export const attachmentRoutes = new Hono<AppEnv>();

attachmentRoutes.use("*", requireAuthz);

async function loadContext(c: Context<AppEnv>) {
  const id = c.req.param("attachmentId");
  if (!id) throw errors.notFound("attachment_not_found");
  const ctx = await getAttachmentContext(c.get("db"), id);
  if (!ctx) throw errors.notFound("attachment_not_found");
  return ctx;
}

attachmentRoutes.get("/:attachmentId", async (c) => {
  const { attachment, eventId, ownerId } = await loadContext(c);
  assertCanViewLead(c.get("authz")!, eventId, ownerId);
  const bytes = await readAttachmentBytes(attachment);
  return new Response(bytes, {
    headers: {
      "content-type": attachment.mimeType,
      "content-length": String(attachment.byteSize),
      "content-disposition": `inline; filename="${
        attachment.originalFilename ?? attachment.id
      }"`,
      "cache-control": "private, no-store",
    },
  });
});

attachmentRoutes.delete("/:attachmentId", async (c) => {
  const { attachment, eventId, ownerId } = await loadContext(c);
  assertCanEditLead(c.get("authz")!, eventId, ownerId);
  await deleteAttachment(c.get("db"), {
    actorId: c.get("user")!.id,
    attachmentId: attachment.id,
    eventId,
  });
  return c.body(null, 204);
});
