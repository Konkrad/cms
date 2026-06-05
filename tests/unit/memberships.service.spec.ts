import { describe, it, expect, afterEach } from "vitest";
import { membershipsService } from "~/services/memberships.service";
import { createTestUser, createTestMembership, openDb } from "./helpers";

const cleanupIds: string[] = [];
const cleanups: (() => void)[] = [];

afterEach(() => {
  const db = openDb();
  for (const id of cleanupIds.splice(0)) {
    db.prepare("DELETE FROM user_memberships WHERE id = ?").run(id);
  }
  db.close();
  for (const fn of cleanups.splice(0)) fn();
});

describe("membershipsService.setTier", () => {
  it("creates a membership if none exists", async () => {
    const { userId, cleanup } = createTestUser();
    cleanups.push(cleanup);

    const m = await membershipsService.setTier(userId, "associated");
    cleanupIds.push(m.id);

    expect(m.tier).toBe("associated");
    expect(m.userId).toBe(userId);
  });

  it("updates an existing membership (upsert — one row per user)", async () => {
    const { userId, cleanup } = createTestUser();
    cleanups.push(cleanup);

    const m1 = await membershipsService.setTier(userId, "associated");
    cleanupIds.push(m1.id);
    const m2 = await membershipsService.setTier(userId, "full");

    const db = openDb();
    const rows = db.prepare("SELECT * FROM user_memberships WHERE user_id = ?").all(userId);
    db.close();

    expect(rows).toHaveLength(1);
    expect(m2.tier).toBe("full");
  });
});

describe("membershipsService.upgradeIfHigher", () => {
  it("upgrades associated → full when called with full", async () => {
    const { userId, cleanup } = createTestUser();
    cleanups.push(cleanup);
    const { membershipId } = createTestMembership(userId, "associated");
    cleanupIds.push(membershipId);

    await membershipsService.upgradeIfHigher(userId, "full");
    const m = await membershipsService.getByUser(userId);

    expect(m?.tier).toBe("full");
  });

  it("does not downgrade full → associated", async () => {
    const { userId, cleanup } = createTestUser();
    cleanups.push(cleanup);
    const { membershipId } = createTestMembership(userId, "full");
    cleanupIds.push(membershipId);

    await membershipsService.upgradeIfHigher(userId, "associated");
    const m = await membershipsService.getByUser(userId);

    expect(m?.tier).toBe("full");
  });

  it("creates a membership if user has none", async () => {
    const { userId, cleanup } = createTestUser();
    cleanups.push(cleanup);

    await membershipsService.upgradeIfHigher(userId, "full");
    const m = await membershipsService.getByUser(userId);
    if (m) cleanupIds.push(m.id);

    expect(m?.tier).toBe("full");
  });
});

describe("membershipsService.hasTier", () => {
  it("returns true for a full member checking associated requirement", async () => {
    const { userId, cleanup } = createTestUser();
    cleanups.push(cleanup);
    const { membershipId } = createTestMembership(userId, "full");
    cleanupIds.push(membershipId);

    expect(await membershipsService.hasTier(userId, "associated")).toBe(true);
  });

  it("returns false for an associated member checking full requirement", async () => {
    const { userId, cleanup } = createTestUser();
    cleanups.push(cleanup);
    const { membershipId } = createTestMembership(userId, "associated");
    cleanupIds.push(membershipId);

    expect(await membershipsService.hasTier(userId, "full")).toBe(false);
  });

  it("returns false when user has no membership row", async () => {
    const { userId, cleanup } = createTestUser();
    cleanups.push(cleanup);

    expect(await membershipsService.hasTier(userId, "associated")).toBe(false);
  });
});
