import { describe, expect, it } from "vitest";
import { createApp } from "./app";

describe("backend app", () => {
  const app = createApp();

  it("GET /api/health returns ok without touching the DB", async () => {
    const res = await app.request("/api/health");
    expect(res.status).toBe(200);
    const body = (await res.json()) as { status: string };
    expect(body.status).toBe("ok");
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

  it("GET /api/health/ready reports unavailable when DB is unreachable", async () => {
    const res = await app.request("/api/health/ready");
    expect(res.status).toBe(503);
    const body = (await res.json()) as { status: string };
    expect(body.status).toBe("unavailable");
  });
});
