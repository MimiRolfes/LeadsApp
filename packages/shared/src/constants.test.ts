import { describe, expect, it } from "vitest";
import {
  APP_NAME,
  DEFAULT_LOCALE,
  EVENT_ROLES,
  GLOBAL_ROLES,
  LEAD_PRIORITIES,
  SYNC_STATES,
} from "./constants";

describe("shared constants", () => {
  it("exposes the product name", () => {
    expect(APP_NAME).toBe("humatter Leads");
  });

  it("defaults to German", () => {
    expect(DEFAULT_LOCALE).toBe("de");
  });

  it("global roles match the DB enum (admin, member)", () => {
    expect(GLOBAL_ROLES).toEqual(["admin", "member"]);
  });

  it("event roles match the DB enum", () => {
    expect(EVENT_ROLES).toEqual(["manager", "member", "readonly"]);
  });

  it("defines hot/warm/cold priorities", () => {
    expect([...LEAD_PRIORITIES].sort()).toEqual(["cold", "hot", "warm"]);
  });

  it("defines all five sync states required by CLAUDE.md", () => {
    expect(SYNC_STATES).toContain("pending");
    expect(SYNC_STATES).toContain("failed");
    expect(SYNC_STATES).toHaveLength(5);
  });
});
