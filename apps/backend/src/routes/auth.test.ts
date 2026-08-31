import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../app";
import { createTestDb, type TestDb } from "../db/testing/pglite";
import { __resetRateLimit } from "../lib/rate-limit";

let db: TestDb;
let app: ReturnType<typeof createApp>;

beforeAll(async () => {
  db = await createTestDb();
  app = createApp({ getDb: () => db });
});
afterAll(async () => {
  await db.$close();
});
beforeEach(() => __resetRateLimit());

function post(
  path: string,
  body: unknown,
  headers: Record<string, string> = {},
) {
  return app.request(path, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

function cookieFrom(res: Response): string {
  const raw = res.headers.get("set-cookie") ?? "";
  return raw.split(";")[0]!;
}

const strongPassword = "correct-horse-battery-staple";

describe("POST /api/auth/register", () => {
  it("creates an account for an allowed email domain and sets a session cookie", async () => {
    const res = await post("/api/auth/register", {
      email: "alice@mindsewn.de",
      password: strongPassword,
    });
    expect(res.status).toBe(201);
    const body = (await res.json()) as {
      user: { email: string; globalRole: string };
    };
    expect(body.user.email).toBe("alice@mindsewn.de");
    expect(body.user.globalRole).toBe("member");

    const cookie = res.headers.get("set-cookie") ?? "";
    expect(cookie).toMatch(/hl_session=/);
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=Lax/i);
  });

  it("rejects a non-allowed email domain with 403", async () => {
    const res = await post("/api/auth/register", {
      email: "bob@gmail.com",
      password: strongPassword,
    });
    expect(res.status).toBe(403);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("email_domain_not_allowed");
  });

  it("rejects a weak password with 422", async () => {
    const res = await post("/api/auth/register", {
      email: "carol@mindsewn.de",
      password: "short",
    });
    expect(res.status).toBe(422);
  });

  it("rejects a duplicate email (case-insensitive) with 409", async () => {
    await post("/api/auth/register", {
      email: "dora@mindsewn.de",
      password: strongPassword,
    });
    const res = await post("/api/auth/register", {
      email: "DORA@mindsewn.de",
      password: strongPassword,
    });
    expect(res.status).toBe(409);
  });
});

describe("POST /api/auth/login", () => {
  beforeAll(async () => {
    await post("/api/auth/register", {
      email: "eric@mindsewn.de",
      password: strongPassword,
    });
  });

  it("logs in with correct credentials and returns the user", async () => {
    const res = await post("/api/auth/login", {
      email: "eric@mindsewn.de",
      password: strongPassword,
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { user: { email: string } };
    expect(body.user.email).toBe("eric@mindsewn.de");
    expect(res.headers.get("set-cookie")).toMatch(/hl_session=/);
  });

  it("returns a generic 401 for a wrong password", async () => {
    const res = await post("/api/auth/login", {
      email: "eric@mindsewn.de",
      password: "wrong-password-value",
    });
    expect(res.status).toBe(401);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("invalid_credentials");
  });

  it("returns the same generic 401 for an unknown email", async () => {
    const res = await post("/api/auth/login", {
      email: "nobody@mindsewn.de",
      password: strongPassword,
    });
    expect(res.status).toBe(401);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("invalid_credentials");
  });
});

describe("session lifecycle", () => {
  it("GET /api/auth/me requires a session, then works with the login cookie", async () => {
    const anon = await app.request("/api/auth/me");
    expect(anon.status).toBe(401);

    await post("/api/auth/register", {
      email: "frank@mindsewn.de",
      password: strongPassword,
    });
    const login = await post("/api/auth/login", {
      email: "frank@mindsewn.de",
      password: strongPassword,
    });
    const cookie = cookieFrom(login);

    const me = await app.request("/api/auth/me", { headers: { cookie } });
    expect(me.status).toBe(200);
    const body = (await me.json()) as { user: { email: string } };
    expect(body.user.email).toBe("frank@mindsewn.de");

    const logout = await app.request("/api/auth/logout", {
      method: "POST",
      headers: { cookie },
    });
    expect(logout.status).toBe(204);

    const after = await app.request("/api/auth/me", { headers: { cookie } });
    expect(after.status).toBe(401);
  });

  it("logout-all invalidates every session of the user", async () => {
    await post("/api/auth/register", {
      email: "gina@mindsewn.de",
      password: strongPassword,
    });
    const a = cookieFrom(
      await post("/api/auth/login", {
        email: "gina@mindsewn.de",
        password: strongPassword,
      }),
    );
    const b = cookieFrom(
      await post("/api/auth/login", {
        email: "gina@mindsewn.de",
        password: strongPassword,
      }),
    );

    await app.request("/api/auth/logout-all", {
      method: "POST",
      headers: { cookie: a },
    });

    for (const cookie of [a, b]) {
      const res = await app.request("/api/auth/me", { headers: { cookie } });
      expect(res.status).toBe(401);
    }
  });
});
