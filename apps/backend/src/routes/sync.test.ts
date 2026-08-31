import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createTestDb, type TestDb } from "../db/testing/pglite";
import { makeClient, uuid } from "../db/testing/http";
import { __resetRateLimit } from "../lib/rate-limit";

let db: TestDb;
let client: ReturnType<typeof makeClient>;

beforeAll(async () => {
  db = await createTestDb();
  client = makeClient(db);
});
afterAll(async () => {
  await db.$close();
});
beforeEach(() => __resetRateLimit());

async function push(cookie: string, operations: unknown[]) {
  const res = await client.req("/api/sync", cookie, {
    method: "POST",
    json: { operations },
  });
  return {
    status: res.status,
    body: (await res.json()) as { results: Array<Record<string, unknown>> },
  };
}

describe("POST /api/sync", () => {
  it("creates queued leads and replays idempotently", async () => {
    const { member, eventId } = await client.setupEvent();
    const l1 = uuid();
    const op = {
      kind: "lead.create",
      localId: l1,
      eventId,
      payload: { clientLocalId: l1, lastName: "Offline1" },
    };

    const first = await push(member, [op]);
    expect(first.status).toBe(200);
    expect(first.body.results[0]!.status).toBe("synced");
    const serverId = first.body.results[0]!.serverId;

    const replay = await push(member, [op]);
    expect(replay.body.results[0]!.status).toBe("synced");
    expect(replay.body.results[0]!.serverId).toBe(serverId);
  });

  it("reports a duplicate as a conflict without blocking other ops", async () => {
    const { member, eventId } = await client.setupEvent();
    await client.req(`/api/events/${eventId}/leads`, member, {
      method: "POST",
      json: { clientLocalId: uuid(), email: "known@x.test", lastName: "A" },
    });

    const a = uuid();
    const b = uuid();
    const { body } = await push(member, [
      {
        kind: "lead.create",
        localId: a,
        eventId,
        payload: { clientLocalId: a, email: "known@x.test", lastName: "B" },
      },
      {
        kind: "lead.create",
        localId: b,
        eventId,
        payload: { clientLocalId: b, lastName: "Fresh" },
      },
    ]);
    const byId = Object.fromEntries(body.results.map((r) => [r.localId, r]));
    expect(byId[a]!.status).toBe("conflict");
    expect(byId[b]!.status).toBe("synced");
  });

  it("returns a version conflict with the current server state", async () => {
    const { member, eventId } = await client.setupEvent();
    const created = (await (
      await client.req(`/api/events/${eventId}/leads`, member, {
        method: "POST",
        json: { clientLocalId: uuid(), lastName: "Sync" },
      })
    ).json()) as { lead: { id: string } };

    const localId = uuid();
    const { body } = await push(member, [
      {
        kind: "lead.update",
        localId,
        eventId,
        leadId: created.lead.id,
        payload: { expectedVersion: 99, priority: "hot" },
      },
    ]);
    expect(body.results[0]!.status).toBe("conflict");
    expect(body.results[0]!.server).toBeTruthy();
  });

  it("applies a valid update and bumps the version", async () => {
    const { member, eventId } = await client.setupEvent();
    const created = (await (
      await client.req(`/api/events/${eventId}/leads`, member, {
        method: "POST",
        json: { clientLocalId: uuid(), lastName: "Sync2" },
      })
    ).json()) as { lead: { id: string } };

    const localId = uuid();
    const { body } = await push(member, [
      {
        kind: "lead.update",
        localId,
        eventId,
        leadId: created.lead.id,
        payload: { expectedVersion: 1, priority: "warm" },
      },
    ]);
    expect(body.results[0]!.status).toBe("synced");
    expect(body.results[0]!.version).toBe(2);
  });
});
