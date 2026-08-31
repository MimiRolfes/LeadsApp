import { afterEach, describe, expect, it, vi } from "vitest";
import { logger } from "./logger";

describe("logger", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("emits single-line JSON with level, ts and msg", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    logger.info("thing happened", { route: "/api/health", outcome: "ok" });

    expect(spy).toHaveBeenCalledOnce();
    const payload = JSON.parse(spy.mock.calls[0]![0] as string);
    expect(payload).toMatchObject({
      level: "info",
      msg: "thing happened",
      route: "/api/health",
      outcome: "ok",
    });
    expect(typeof payload.ts).toBe("string");
  });

  it("redacts PII-ish fields", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    logger.info("lead created", {
      email: "person@example.com",
      lastName: "Doe",
      leadId: "abc",
    });

    const payload = JSON.parse(spy.mock.calls[0]![0] as string);
    expect(payload.email).toBe("[redacted]");
    expect(payload.lastName).toBe("[redacted]");
    expect(payload.leadId).toBe("abc");
  });

  it("routes warn/error to console.error", () => {
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    logger.error("boom", { code: "E_TEST" });
    expect(errSpy).toHaveBeenCalledOnce();
  });
});
