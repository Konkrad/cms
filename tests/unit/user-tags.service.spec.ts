import { describe, it, expect, afterEach, vi, beforeEach } from "vitest";
import { userTagsService } from "~/services/user-tags.service";
import { createTestUser, createTestEvent, createTestParticipation, openDb } from "./helpers";

const cleanupTagSlugs: Array<{ userId: string; slug: string }> = [];
const cleanups: (() => void)[] = [];

afterEach(() => {
  const db = openDb();
  for (const { userId, slug } of cleanupTagSlugs.splice(0)) {
    db.prepare("DELETE FROM user_tags WHERE user_id = ? AND slug = ?").run(userId, slug);
  }
  db.close();
  for (const fn of cleanups.splice(0)) fn();
  vi.restoreAllMocks();
});

describe("userTagsService.grant", () => {
  it("creates a tag row", async () => {
    const { userId, cleanup } = createTestUser();
    cleanups.push(cleanup);
    cleanupTagSlugs.push({ userId, slug: "test-grant" });

    const tag = await userTagsService.grant(userId, "test-grant", "Test", "custom", "manual");
    expect(tag.slug).toBe("test-grant");
    expect(tag.userId).toBe(userId);
  });

  it("is idempotent — calling twice returns same row", async () => {
    const { userId, cleanup } = createTestUser();
    cleanups.push(cleanup);
    cleanupTagSlugs.push({ userId, slug: "idem-tag" });

    const t1 = await userTagsService.grant(userId, "idem-tag", "Label", "custom", "manual");
    const t2 = await userTagsService.grant(userId, "idem-tag", "Label", "custom", "manual");

    expect(t1.id).toBe(t2.id);

    const db = openDb();
    const rows = db.prepare("SELECT * FROM user_tags WHERE user_id = ? AND slug = ?").all(userId, "idem-tag");
    db.close();
    expect(rows).toHaveLength(1);
  });
});

describe("userTagsService.adminGrant", () => {
  it("sets sourceType to manual and records grantedBy", async () => {
    const { userId, cleanup } = createTestUser();
    const { userId: adminId, cleanup: ac } = createTestUser();
    cleanups.push(cleanup, ac);
    cleanupTagSlugs.push({ userId, slug: "admin-tag" });

    const tag = await userTagsService.adminGrant(userId, "admin-tag", "Admin Tag", "custom", adminId);
    expect(tag.sourceType).toBe("manual");
    expect(tag.grantedBy).toBe(adminId);
  });
});

describe("userTagsService.revoke", () => {
  it("deletes the tag row", async () => {
    const { userId, cleanup } = createTestUser();
    cleanups.push(cleanup);

    await userTagsService.grant(userId, "revoke-me", "Revoke", "custom", "manual");
    await userTagsService.revoke(userId, "revoke-me");

    const db = openDb();
    const row = db.prepare("SELECT * FROM user_tags WHERE user_id = ? AND slug = ?").get(userId, "revoke-me");
    db.close();
    expect(row).toBeUndefined();
  });
});

describe("userTagsService.evaluateRulesForUser", () => {
  beforeEach(() => {
    vi.mock("~/config/tag-rules", () => ({
      TAG_RULES: [
        {
          slug: "test-total-badge",
          label: "Test Total Badge",
          category: "participation",
          conditionType: "participation_total",
          conditionCount: 2,
        },
        {
          slug: "test-location-badge",
          label: "Test Location Badge",
          category: "participation",
          conditionType: "participation_locationType",
          conditionCount: 1,
          conditionFilter: "in-person",
        },
      ],
    }));
  });

  it("grants total badge when threshold is met", async () => {
    const { userId, cleanup } = createTestUser();
    cleanups.push(cleanup);
    cleanupTagSlugs.push({ userId, slug: "test-total-badge" });

    const e1 = createTestEvent(userId, { locationType: "online" });
    const e2 = createTestEvent(userId, { locationType: "online" });
    cleanups.push(e1.cleanup, e2.cleanup);
    const p1 = createTestParticipation(userId, e1.eventId, "yes");
    const p2 = createTestParticipation(userId, e2.eventId, "yes");
    cleanups.push(p1.cleanup, p2.cleanup);

    await userTagsService.evaluateRulesForUser(userId);

    const tags = await userTagsService.getByUser(userId);
    expect(tags.some((t) => t.slug === "test-total-badge")).toBe(true);
  });

  it("does not grant total badge when threshold is not met", async () => {
    const { userId, cleanup } = createTestUser();
    cleanups.push(cleanup);

    const e1 = createTestEvent(userId);
    cleanups.push(e1.cleanup);
    const p1 = createTestParticipation(userId, e1.eventId, "yes");
    cleanups.push(p1.cleanup);

    await userTagsService.evaluateRulesForUser(userId);

    const tags = await userTagsService.getByUser(userId);
    expect(tags.some((t) => t.slug === "test-total-badge")).toBe(false);
  });

  it("only counts in-person events for locationType rule", async () => {
    const { userId, cleanup } = createTestUser();
    cleanups.push(cleanup);
    cleanupTagSlugs.push({ userId, slug: "test-location-badge" });

    const online = createTestEvent(userId, { locationType: "online" });
    const inPerson = createTestEvent(userId, { locationType: "in-person" });
    cleanups.push(online.cleanup, inPerson.cleanup);
    const p1 = createTestParticipation(userId, online.eventId, "yes");
    const p2 = createTestParticipation(userId, inPerson.eventId, "yes");
    cleanups.push(p1.cleanup, p2.cleanup);

    await userTagsService.evaluateRulesForUser(userId);

    const tags = await userTagsService.getByUser(userId);
    // in-person badge granted (threshold 1 met)
    expect(tags.some((t) => t.slug === "test-location-badge")).toBe(true);
  });

  it("is idempotent — evaluating twice creates one tag", async () => {
    const { userId, cleanup } = createTestUser();
    cleanups.push(cleanup);
    cleanupTagSlugs.push({ userId, slug: "test-total-badge" });

    const e1 = createTestEvent(userId);
    const e2 = createTestEvent(userId);
    cleanups.push(e1.cleanup, e2.cleanup);
    cleanups.push(createTestParticipation(userId, e1.eventId).cleanup);
    cleanups.push(createTestParticipation(userId, e2.eventId).cleanup);

    await userTagsService.evaluateRulesForUser(userId);
    await userTagsService.evaluateRulesForUser(userId);

    const db = openDb();
    const rows = db.prepare("SELECT * FROM user_tags WHERE user_id = ? AND slug = ?").all(userId, "test-total-badge");
    db.close();
    expect(rows).toHaveLength(1);
  });
});
