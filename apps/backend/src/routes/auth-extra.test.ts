import { sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createTestDb, type TestDb } from "../db/testing/pglite";
import { makeClient } from "../db/testing/http";
import { passwordResetTokens, users } from "../db/schema";
import { generateToken, hashToken } from "../lib/tokens";
import { currentCode } from "../lib/totp";
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

const PW = "horse-staple-7";

function jpost(path: string, body: unknown, cookie?: string) {
  return client.req(path, cookie ?? "", { method: "POST", json: body });
}

describe("password reset", () => {
  it("responds 202 for unknown and known emails alike", async () => {
    await client.login("known@mindsewn.de");
    for (const email of ["known@mindsewn.de", "ghost@mindsewn.de"]) {
      const res = await jpost("/api/auth/password/forgot", { email });
      expect(res.status).toBe(202);
    }
  });

  it("resets the password with a valid token and revokes sessions", async () => {
    const email = "reset@mindsewn.de";
    const cookie = await client.login(email);
    // eine gültige Session besteht
    expect((await client.req("/api/auth/me", cookie)).status).toBe(200);

    // Token direkt setzen (der Mailer versendet nur ins Log)
    const raw = generateToken();
    const [u] = await db
      .select({ id: users.id })
      .from(users)
      .where(sql`lower(${users.email}) = ${email}`);
    await db.insert(passwordResetTokens).values({
      userId: u!.id,
      tokenHash: await hashToken(raw),
      expiresAt: new Date(Date.now() + 3_600_000),
    });

    const done = await jpost("/api/auth/password/reset", {
      token: raw,
      password: "a-brand-new-password-99",
    });
    expect(done.status).toBe(204);

    // alte Session ungültig
    expect((await client.req("/api/auth/me", cookie)).status).toBe(401);
    // Login mit neuem Passwort
    const login = await client.req("/api/auth/login", "", {
      method: "POST",
      json: { email, password: "a-brand-new-password-99" },
    });
    expect(login.status).toBe(200);
  });

  it("rejects an invalid reset token", async () => {
    const res = await jpost("/api/auth/password/reset", {
      token: "definitely-not-a-real-token",
      password: PW + "x",
    });
    expect(res.status).toBe(400);
  });
});

describe("optional 2FA (TOTP)", () => {
  it("enables 2FA, then requires the code on login, then disables it", async () => {
    const email = "tfa@mindsewn.de";
    const cookie = await client.login(email);

    const setup = (await (
      await jpost("/api/auth/2fa/setup", {}, cookie)
    ).json()) as { secret: string; otpauthUri: string };
    expect(setup.otpauthUri).toContain("otpauth://totp/");

    const badEnable = await jpost(
      "/api/auth/2fa/enable",
      { secret: setup.secret, code: "000000" },
      cookie,
    );
    expect(badEnable.status).toBe(400);

    const enable = await jpost(
      "/api/auth/2fa/enable",
      { secret: setup.secret, code: currentCode(setup.secret) },
      cookie,
    );
    expect(enable.status).toBe(200);

    // Login ohne Code
    const noCode = await client.req("/api/auth/login", "", {
      method: "POST",
      json: { email, password: PW },
    });
    expect(noCode.status).toBe(401);
    expect(
      ((await noCode.json()) as { error: { code: string } }).error.code,
    ).toBe("totp_required");

    // Login mit Code
    const withCode = await client.req("/api/auth/login", "", {
      method: "POST",
      json: { email, password: PW, code: currentCode(setup.secret) },
    });
    expect(withCode.status).toBe(200);
    const freshCookie = (withCode.headers.get("set-cookie") ?? "").split(
      ";",
    )[0]!;

    const disable = await jpost(
      "/api/auth/2fa/disable",
      { code: currentCode(setup.secret) },
      freshCookie,
    );
    expect(disable.status).toBe(204);
  });
});
