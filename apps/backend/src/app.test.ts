import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "./app";
import { createTestDb, type TestDb } from "./db/testing/pglite";

let db: TestDb;
let app: ReturnType<typeof createApp>;

beforeAll(async () => {
  db = await createTestDb();
  app = createApp({ getDb: () => db });
});

afterAll(async () => {
  await db.$close();
});

describe("backend app", () => {
  it("GET /api/health returns ok without touching the DB", async () => {
    const res = await app.request("/api/health");
    expect(res.status).toBe(200);
    const body = (await res.json()) as { status: string };
    expect(body.status).toBe("ok");
  });

  it("GET /api/health/ready returns ready when the DB is reachable", async () => {
    const res = await app.request("/api/health/ready");
    expect(res.status).toBe(200);
    const body = (await res.json()) as { status: string };
    expect(body.status).toBe("ready");
  });

  it("sets baseline security headers", async () => {
    const res = await app.request("/api/health");
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
  });

  it("unknown route returns a structured 404 (no stack trace)", async () => {
    const res = await app.request("/api/does-not-exist");
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: { code: "not_found" } });
  });

  it("rejects state-changing requests from a foreign Origin", async () => {
    const res = await app.request("/api/auth/login", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: "https://evil.example",
      },
      body: JSON.stringify({ email: "a@mindsewn.de", password: "x" }),
    });
    expect(res.status).toBe(403);
  });
});
