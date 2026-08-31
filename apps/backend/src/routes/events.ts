import { Hono, type Context } from "hono";
import { zValidator } from "@hono/zod-validator";
import {
  EventCreateSchema,
  EventMemberAddSchema,
  EventUpdateSchema,
  FollowupListQuerySchema,
  FollowupTemplateCreateSchema,
  LeadCreateSchema,
  LeadListQuerySchema,
  QuestionCreateSchema,
  QuestionUpdateSchema,
} from "@humatter-leads/shared";
import type { AppEnv } from "../types";
import { requireAuthz } from "../auth/middleware";
import {
  assertCanCaptureLead,
  assertCanManageEvent,
  assertCanManageQuestions,
  assertCanViewEvent,
  isEventManager,
} from "../authz";
import { createLead, listLeads } from "../domain/leads";
import {
  createTemplate,
  listEventFollowups,
  listTemplates,
} from "../domain/followups";
import { clientIp } from "../lib/rate-limit";
import {
  addMember,
  archiveQuestion,
  createEvent,
  createQuestion,
  getEvent,
  listEventsForUser,
  listMembers,
  listQuestions,
  removeMember,
  updateEvent,
  updateQuestion,
} from "../domain/events";
import { errors } from "../lib/errors";
import { onInvalid } from "../lib/validation";

/**
 * Event-/Team-/Fragenkatalog-Verwaltung. Alle Routen erfordern Anmeldung;
 * die Autorisierung läuft ausschließlich über die zentrale `assert*`-Schicht.
 */
export const eventsRoutes = new Hono<AppEnv>();

eventsRoutes.use("*", requireAuthz);

function paramOr404(c: Context<AppEnv>, name: string): string {
  const value = c.req.param(name);
  if (!value) throw errors.notFound("not_found");
  return value;
}

/** Lädt das Event und prüft Sichtbarkeit. */
async function loadVisibleEvent(c: Context<AppEnv>) {
  const eventId = paramOr404(c, "eventId");
  const event = await getEvent(c.get("db"), eventId);
  if (!event) throw errors.notFound("event_not_found");
  assertCanViewEvent(c.get("authz")!, eventId);
  return event;
}

eventsRoutes.get("/", async (c) => {
  const list = await listEventsForUser(c.get("db"), c.get("authz")!);
  return c.json({ events: list });
});

eventsRoutes.post(
  "/",
  zValidator("json", EventCreateSchema, onInvalid),
  async (c) => {
    const event = await createEvent(
      c.get("db"),
      c.get("user")!.id,
      c.req.valid("json"),
    );
    return c.json({ event }, 201);
  },
);

eventsRoutes.get("/:eventId", async (c) => {
  const event = await loadVisibleEvent(c);
  return c.json({ event });
});

eventsRoutes.patch(
  "/:eventId",
  zValidator("json", EventUpdateSchema, onInvalid),
  async (c) => {
    const eventId = c.req.param("eventId");
    assertCanManageEvent(c.get("authz")!, eventId);
    const event = await updateEvent(
      c.get("db"),
      c.get("user")!.id,
      eventId,
      c.req.valid("json"),
    );
    return c.json({ event });
  },
);

// --- Team ----------------------------------------------------------

eventsRoutes.get("/:eventId/members", async (c) => {
  await loadVisibleEvent(c);
  return c.json({
    members: await listMembers(c.get("db"), c.req.param("eventId")),
  });
});

eventsRoutes.post(
  "/:eventId/members",
  zValidator("json", EventMemberAddSchema, onInvalid),
  async (c) => {
    const eventId = c.req.param("eventId");
    assertCanManageEvent(c.get("authz")!, eventId);
    const members = await addMember(
      c.get("db"),
      c.get("user")!.id,
      eventId,
      c.req.valid("json"),
    );
    return c.json({ members });
  },
);

eventsRoutes.delete("/:eventId/members/:userId", async (c) => {
  const eventId = c.req.param("eventId");
  assertCanManageEvent(c.get("authz")!, eventId);
  if (c.req.param("userId") === c.get("user")!.id && !c.get("authz")!.isAdmin) {
    throw errors.badRequest(
      "cannot_remove_self",
      "Sich selbst kann man nicht aus dem Event entfernen.",
    );
  }
  await removeMember(
    c.get("db"),
    c.get("user")!.id,
    eventId,
    c.req.param("userId"),
  );
  return c.body(null, 204);
});

// --- Fragenkatalog ----------------------------------------------

eventsRoutes.get("/:eventId/questions", async (c) => {
  await loadVisibleEvent(c);
  const includeArchived = c.req.query("archived") === "true";
  return c.json({
    questions: await listQuestions(c.get("db"), c.req.param("eventId"), {
      includeArchived,
    }),
  });
});

eventsRoutes.post(
  "/:eventId/questions",
  zValidator("json", QuestionCreateSchema, onInvalid),
  async (c) => {
    const eventId = c.req.param("eventId");
    assertCanManageQuestions(c.get("authz")!, eventId);
    const question = await createQuestion(
      c.get("db"),
      c.get("user")!.id,
      eventId,
      c.req.valid("json"),
    );
    return c.json({ question }, 201);
  },
);

eventsRoutes.patch(
  "/:eventId/questions/:questionId",
  zValidator("json", QuestionUpdateSchema, onInvalid),
  async (c) => {
    const eventId = c.req.param("eventId");
    assertCanManageQuestions(c.get("authz")!, eventId);
    const question = await updateQuestion(
      c.get("db"),
      c.get("user")!.id,
      eventId,
      c.req.param("questionId"),
      c.req.valid("json"),
    );
    return c.json({ question });
  },
);

eventsRoutes.post("/:eventId/questions/:questionId/archive", async (c) => {
  const eventId = c.req.param("eventId");
  assertCanManageQuestions(c.get("authz")!, eventId);
  await archiveQuestion(
    c.get("db"),
    c.get("user")!.id,
    eventId,
    c.req.param("questionId"),
  );
  return c.body(null, 204);
});

// --- Leads (event-gescopt) --------------------------------------

eventsRoutes.get(
  "/:eventId/leads",
  zValidator("query", LeadListQuerySchema, onInvalid),
  async (c) => {
    const event = await loadVisibleEvent(c);
    const ctx = c.get("authz")!;
    const q = c.req.valid("query");
    // Nicht-Manager sehen nur eigene Leads (PROJECT.md).
    const scope = isEventManager(ctx, event.id) ? (q.scope ?? "all") : "mine";
    const result = await listLeads(c.get("db"), {
      eventId: event.id,
      scope,
      userId: ctx.userId,
      priority: q.priority,
      ownerId: q.ownerId,
      q: q.q,
      tag: q.tag,
      limit: q.limit,
      offset: q.offset,
    });
    return c.json({ leads: result.items, total: result.total });
  },
);

eventsRoutes.post(
  "/:eventId/leads",
  zValidator("json", LeadCreateSchema, onInvalid),
  async (c) => {
    const eventId = paramOr404(c, "eventId");
    assertCanCaptureLead(c.get("authz")!, eventId);
    const result = await createLead(c.get("db"), {
      actorId: c.get("user")!.id,
      eventId,
      input: c.req.valid("json"),
      ip: clientIp(c),
    });
    if (result.status === "duplicate") {
      return c.json(
        { error: { code: "duplicate_found" }, candidates: result.candidates },
        409,
      );
    }
    return c.json(
      { lead: result.lead },
      result.status === "created" ? 201 : 200,
    );
  },
);

// --- Follow-ups (event-gescopt) --------------------------------

eventsRoutes.get(
  "/:eventId/followups",
  zValidator("query", FollowupListQuerySchema, onInvalid),
  async (c) => {
    const event = await loadVisibleEvent(c);
    const ctx = c.get("authz")!;
    const q = c.req.valid("query");
    const assigneeId = isEventManager(ctx, event.id)
      ? q.assigneeId
      : ctx.userId;
    const items = await listEventFollowups(c.get("db"), {
      eventId: event.id,
      assigneeId,
      status: q.status,
      due: q.due,
    });
    return c.json({ followups: items });
  },
);

eventsRoutes.get("/:eventId/followup-templates", async (c) => {
  const event = await loadVisibleEvent(c);
  return c.json({ templates: await listTemplates(c.get("db"), event.id) });
});

eventsRoutes.post(
  "/:eventId/followup-templates",
  zValidator("json", FollowupTemplateCreateSchema, onInvalid),
  async (c) => {
    const eventId = paramOr404(c, "eventId");
    assertCanManageEvent(c.get("authz")!, eventId);
    const template = await createTemplate(c.get("db"), {
      actorId: c.get("user")!.id,
      eventId,
      input: c.req.valid("json"),
    });
    return c.json({ template }, 201);
  },
);
