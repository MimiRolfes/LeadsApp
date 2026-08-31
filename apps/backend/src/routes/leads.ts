import { Hono, type Context } from "hono";
import { zValidator } from "@hono/zod-validator";
import {
  FollowupCreateSchema,
  LeadDeleteSchema,
  LeadMergeSchema,
  LeadNoteCreateSchema,
  LeadUpdateSchema,
} from "@humatter-leads/shared";
import type { AppEnv } from "../types";
import { requireAuthz } from "../auth/middleware";
import {
  assertCanEditLead,
  assertCanMergeLeads,
  assertCanRunDsgvoAction,
  assertCanViewLead,
} from "../authz";
import {
  addLeadNote,
  getLeadDetail,
  getLeadRef,
  softDeleteLead,
  updateLead,
} from "../domain/leads";
import { createFollowup } from "../domain/followups";
import { mergeLeads } from "../domain/merge";
import { anonymizeLead, eraseLead, subjectAccess } from "../domain/dsgvo";
import { createAttachment, listLeadAttachments } from "../domain/attachments";
import { errors } from "../lib/errors";
import { onInvalid } from "../lib/validation";

/**
 * Lead-Detail-Operationen (by id). Event-gescoptes Erfassen/Listen liegt
 * unter `/api/events/:eventId/leads` (routes/events.ts).
 */
export const leadRoutes = new Hono<AppEnv>();

leadRoutes.use("*", requireAuthz);

async function loadRef(c: Context<AppEnv>) {
  const leadId = c.req.param("leadId");
  if (!leadId) throw errors.notFound("lead_not_found");
  const ref = await getLeadRef(c.get("db"), leadId);
  if (!ref) throw errors.notFound("lead_not_found");
  return ref;
}

leadRoutes.get("/:leadId", async (c) => {
  const ref = await loadRef(c);
  assertCanViewLead(c.get("authz")!, ref.eventId, ref.ownerId);
  return c.json(await getLeadDetail(c.get("db"), ref.id));
});

leadRoutes.patch(
  "/:leadId",
  zValidator("json", LeadUpdateSchema, onInvalid),
  async (c) => {
    const ref = await loadRef(c);
    assertCanEditLead(c.get("authz")!, ref.eventId, ref.ownerId);
    const lead = await updateLead(c.get("db"), {
      actorId: c.get("user")!.id,
      leadId: ref.id,
      eventId: ref.eventId,
      patch: c.req.valid("json"),
    });
    return c.json({ lead });
  },
);

leadRoutes.delete("/:leadId", async (c) => {
  const ref = await loadRef(c);
  assertCanEditLead(c.get("authz")!, ref.eventId, ref.ownerId);
  await softDeleteLead(c.get("db"), {
    actorId: c.get("user")!.id,
    leadId: ref.id,
    eventId: ref.eventId,
  });
  return c.body(null, 204);
});

leadRoutes.post(
  "/:leadId/notes",
  zValidator("json", LeadNoteCreateSchema, onInvalid),
  async (c) => {
    const ref = await loadRef(c);
    assertCanEditLead(c.get("authz")!, ref.eventId, ref.ownerId);
    const note = await addLeadNote(c.get("db"), {
      actorId: c.get("user")!.id,
      leadId: ref.id,
      eventId: ref.eventId,
      input: c.req.valid("json"),
    });
    return c.json({ note }, 201);
  },
);

leadRoutes.post(
  "/:leadId/followups",
  zValidator("json", FollowupCreateSchema, onInvalid),
  async (c) => {
    const ref = await loadRef(c);
    assertCanEditLead(c.get("authz")!, ref.eventId, ref.ownerId);
    const followup = await createFollowup(c.get("db"), {
      actorId: c.get("user")!.id,
      leadId: ref.id,
      eventId: ref.eventId,
      input: c.req.valid("json"),
    });
    return c.json({ followup }, 201);
  },
);

// --- Merge -------------------------------------------------------

leadRoutes.post(
  "/:leadId/merge",
  zValidator("json", LeadMergeSchema, onInvalid),
  async (c) => {
    const ref = await loadRef(c);
    assertCanMergeLeads(c.get("authz")!, ref.eventId);
    const lead = await mergeLeads(c.get("db"), {
      actorId: c.get("user")!.id,
      survivingLeadId: ref.id,
      eventId: ref.eventId,
      input: c.req.valid("json"),
    });
    return c.json({ lead });
  },
);

// --- Anhänge ---------------------------------------------------

leadRoutes.get("/:leadId/attachments", async (c) => {
  const ref = await loadRef(c);
  assertCanViewLead(c.get("authz")!, ref.eventId, ref.ownerId);
  return c.json({
    attachments: await listLeadAttachments(c.get("db"), ref.id),
  });
});

leadRoutes.post("/:leadId/attachments", async (c) => {
  const ref = await loadRef(c);
  assertCanEditLead(c.get("authz")!, ref.eventId, ref.ownerId);
  const body = await c.req.parseBody();
  const file = body["file"];
  if (!(file instanceof File)) {
    throw errors.badRequest("no_file", "Feld 'file' (multipart) fehlt.");
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  const attachment = await createAttachment(c.get("db"), {
    actorId: c.get("user")!.id,
    leadId: ref.id,
    eventId: ref.eventId,
    bytes,
    originalFilename: file.name,
  });
  return c.json({ attachment }, 201);
});

// --- Betroffenenrechte (DSGVO) --------------------------------

leadRoutes.get("/:leadId/data", async (c) => {
  const ref = await loadRef(c);
  assertCanRunDsgvoAction(c.get("authz")!, ref.eventId);
  return c.json(await subjectAccess(c.get("db"), ref.id));
});

leadRoutes.post(
  "/:leadId/delete",
  zValidator("json", LeadDeleteSchema, onInvalid),
  async (c) => {
    const ref = await loadRef(c);
    assertCanRunDsgvoAction(c.get("authz")!, ref.eventId);
    const args = {
      actorId: c.get("user")!.id,
      leadId: ref.id,
      eventId: ref.eventId,
    };
    if (c.req.valid("json").mode === "erase") {
      await eraseLead(c.get("db"), args);
    } else {
      await anonymizeLead(c.get("db"), args);
    }
    return c.body(null, 204);
  },
);
