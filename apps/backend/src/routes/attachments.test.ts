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

const PNG = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4, 5, 6, 7, 8,
]);
const NOT_AN_IMAGE = new TextEncoder().encode("<script>alert(1)</script>");

async function makeLead(cookie: string, eventId: string) {
  const res = await client.req(`/api/events/${eventId}/leads`, cookie, {
    method: "POST",
    json: { clientLocalId: uuid(), lastName: "A" },
  });
  return ((await res.json()) as { lead: { id: string } }).lead.id;
}

function upload(path: string, cookie: string, bytes: Uint8Array, name: string) {
  const fd = new FormData();
  fd.append("file", new Blob([bytes]), name);
  return client.app.request(path, {
    method: "POST",
    headers: { cookie },
    body: fd,
  });
}

describe("attachments", () => {
  it("uploads a PNG and serves it back; rejects a spoofed type", async () => {
    const { member, eventId } = await client.setupEvent();
    const leadId = await makeLead(member, eventId);

    const bad = await upload(
      `/api/leads/${leadId}/attachments`,
      member,
      NOT_AN_IMAGE,
      "evil.png",
    );
    expect(bad.status).toBe(400);

    const ok = await upload(
      `/api/leads/${leadId}/attachments`,
      member,
      PNG,
      "card.png",
    );
    expect(ok.status).toBe(201);
    const { attachment } = (await ok.json()) as {
      attachment: { id: string; mimeType: string; scanStatus: string };
    };
    expect(attachment.mimeType).toBe("image/png");
    // NODE_ENV=test -> auto approve
    expect(attachment.scanStatus).toBe("clean");

    const file = await client.req(`/api/attachments/${attachment.id}`, member);
    expect(file.status).toBe(200);
    expect(file.headers.get("content-type")).toBe("image/png");
    expect(new Uint8Array(await file.arrayBuffer())).toEqual(PNG);
  });

  it("a colleague (non-owner member) cannot download the attachment", async () => {
    const { mgr, eventId } = await client.setupEvent();
    const otherEmail = `x-${uuid()}@mindsewn.de`;
    const other = await client.login(otherEmail);
    await client.req(`/api/events/${eventId}/members`, mgr, {
      method: "POST",
      json: { email: otherEmail, eventRole: "member" },
    });

    const leadId = await makeLead(mgr, eventId);
    const up = await upload(
      `/api/leads/${leadId}/attachments`,
      mgr,
      PNG,
      "c.png",
    );
    const { attachment } = (await up.json()) as { attachment: { id: string } };

    const res = await client.req(`/api/attachments/${attachment.id}`, other);
    expect(res.status).toBe(403);
  });

  it("deletes an attachment", async () => {
    const { member, eventId } = await client.setupEvent();
    const leadId = await makeLead(member, eventId);
    const up = await upload(
      `/api/leads/${leadId}/attachments`,
      member,
      PNG,
      "d.png",
    );
    const { attachment } = (await up.json()) as { attachment: { id: string } };

    expect(
      (
        await client.req(`/api/attachments/${attachment.id}`, member, {
          method: "DELETE",
        })
      ).status,
    ).toBe(204);
    expect(
      (await client.req(`/api/attachments/${attachment.id}`, member)).status,
    ).toBe(404);
  });
});
