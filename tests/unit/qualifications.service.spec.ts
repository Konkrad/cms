import { describe, it, expect, afterEach } from "vitest";
import { qualificationsService } from "~/services/qualifications.service";
import { membershipsService } from "~/services/memberships.service";
import { userTagsService } from "~/services/user-tags.service";
import {
  createTestUser,
  createTestQualificationType,
  openDb,
} from "./helpers";

const cleanupTypeIds: string[] = [];
const cleanupQualIds: string[] = [];
const cleanups: (() => void)[] = [];

afterEach(() => {
  const db = openDb();
  for (const id of cleanupQualIds.splice(0)) {
    db.prepare("DELETE FROM user_qualifications WHERE id = ?").run(id);
  }
  for (const id of cleanupTypeIds.splice(0)) {
    db.prepare("DELETE FROM user_qualifications WHERE type_id = ?").run(id);
    db.prepare("DELETE FROM qualification_types WHERE id = ?").run(id);
  }
  db.close();
  for (const fn of cleanups.splice(0)) fn();
});

describe("qualificationsService.upsert", () => {
  it("creates a qualification with status pending", async () => {
    const { userId, cleanup } = createTestUser();
    cleanups.push(cleanup);
    const { typeId, cleanup: tc } = createTestQualificationType();
    cleanups.push(tc);

    const q = await qualificationsService.upsert(userId, typeId);
    cleanupQualIds.push(q.id);

    expect(q.status).toBe("pending");
    expect(q.userId).toBe(userId);
    expect(q.typeId).toBe(typeId);
  });

  it("returns the existing row if called twice (no duplicate)", async () => {
    const { userId, cleanup } = createTestUser();
    cleanups.push(cleanup);
    const { typeId, cleanup: tc } = createTestQualificationType();
    cleanups.push(tc);

    const q1 = await qualificationsService.upsert(userId, typeId);
    const q2 = await qualificationsService.upsert(userId, typeId);
    cleanupQualIds.push(q1.id);

    const db = openDb();
    const rows = db.prepare("SELECT * FROM user_qualifications WHERE user_id = ? AND type_id = ?").all(userId, typeId);
    db.close();

    expect(rows).toHaveLength(1);
    expect(q1.id).toBe(q2.id);
  });
});

describe("qualificationsService.approve", () => {
  it("sets status to approved and records verifiedBy", async () => {
    const { userId, cleanup } = createTestUser();
    const { userId: adminId, cleanup: adminCleanup } = createTestUser();
    cleanups.push(cleanup, adminCleanup);
    const { typeId, cleanup: tc } = createTestQualificationType({ grantsMembershipTier: "associated" });
    cleanups.push(tc);

    const q = await qualificationsService.upsert(userId, typeId);
    cleanupQualIds.push(q.id);

    const approved = await qualificationsService.approve(q.id, adminId);
    expect(approved.status).toBe("approved");
    expect(approved.verifiedBy).toBe(adminId);
    expect(approved.verifiedAt).toBeTruthy();
  });

  it("upgrades membership to the type's grantsMembershipTier", async () => {
    const { userId, cleanup } = createTestUser();
    const { userId: adminId, cleanup: ac } = createTestUser();
    cleanups.push(cleanup, ac);
    const { typeId, cleanup: tc } = createTestQualificationType({ grantsMembershipTier: "full" });
    cleanups.push(tc);

    const q = await qualificationsService.upsert(userId, typeId);
    cleanupQualIds.push(q.id);

    await qualificationsService.approve(q.id, adminId);
    const membership = await membershipsService.getByUser(userId);

    expect(membership?.tier).toBe("full");

    // cleanup membership
    if (membership) {
      const db = openDb();
      db.prepare("DELETE FROM user_memberships WHERE id = ?").run(membership.id);
      db.close();
    }
  });

  it("does not downgrade membership when type grants a lower tier", async () => {
    const { userId, cleanup } = createTestUser();
    const { userId: adminId, cleanup: ac } = createTestUser();
    cleanups.push(cleanup, ac);

    // User already has full membership
    const db = openDb();
    const mId = require("crypto").randomUUID();
    db.prepare(`INSERT INTO user_memberships (id, user_id, tier, granted_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`).run(
      mId, userId, "full", new Date().toISOString(), new Date().toISOString(), new Date().toISOString(),
    );
    db.close();

    const { typeId, cleanup: tc } = createTestQualificationType({ grantsMembershipTier: "associated" });
    cleanups.push(tc);

    const q = await qualificationsService.upsert(userId, typeId);
    cleanupQualIds.push(q.id);

    await qualificationsService.approve(q.id, adminId);
    const membership = await membershipsService.getByUser(userId);

    expect(membership?.tier).toBe("full"); // unchanged

    const db2 = openDb();
    db2.prepare("DELETE FROM user_memberships WHERE id = ?").run(mId);
    db2.close();
  });

  it("grants a tag with slug matching the qualification type", async () => {
    const { userId, cleanup } = createTestUser();
    const { userId: adminId, cleanup: ac } = createTestUser();
    cleanups.push(cleanup, ac);
    const slug = `test-qual-${Date.now()}`;
    const { typeId, cleanup: tc } = createTestQualificationType({ slug, grantsMembershipTier: "associated" });
    cleanups.push(tc);

    const q = await qualificationsService.upsert(userId, typeId);
    cleanupQualIds.push(q.id);

    await qualificationsService.approve(q.id, adminId);
    const tags = await userTagsService.getByUser(userId);

    expect(tags.some((t) => t.slug === slug)).toBe(true);

    // cleanup tag and membership
    const db = openDb();
    db.prepare("DELETE FROM user_tags WHERE user_id = ?").run(userId);
    db.prepare("DELETE FROM user_memberships WHERE user_id = ?").run(userId);
    db.close();
  });

  it("is idempotent — approving twice creates only one tag", async () => {
    const { userId, cleanup } = createTestUser();
    const { userId: adminId, cleanup: ac } = createTestUser();
    cleanups.push(cleanup, ac);
    const slug = `idem-${Date.now()}`;
    const { typeId, cleanup: tc } = createTestQualificationType({ slug, grantsMembershipTier: "associated" });
    cleanups.push(tc);

    const q = await qualificationsService.upsert(userId, typeId);
    cleanupQualIds.push(q.id);

    await qualificationsService.approve(q.id, adminId);
    await qualificationsService.approve(q.id, adminId);

    const tags = await userTagsService.getByUser(userId);
    expect(tags.filter((t) => t.slug === slug)).toHaveLength(1);

    const db = openDb();
    db.prepare("DELETE FROM user_tags WHERE user_id = ?").run(userId);
    db.prepare("DELETE FROM user_memberships WHERE user_id = ?").run(userId);
    db.close();
  });
});

describe("qualificationsService.reject", () => {
  it("sets status to rejected with notes, no membership change, no tag", async () => {
    const { userId, cleanup } = createTestUser();
    const { userId: adminId, cleanup: ac } = createTestUser();
    cleanups.push(cleanup, ac);
    const { typeId, cleanup: tc } = createTestQualificationType({ grantsMembershipTier: "full" });
    cleanups.push(tc);

    const q = await qualificationsService.upsert(userId, typeId);
    cleanupQualIds.push(q.id);

    const rejected = await qualificationsService.reject(q.id, adminId, "Not eligible");

    expect(rejected.status).toBe("rejected");
    expect(rejected.notes).toBe("Not eligible");

    const membership = await membershipsService.getByUser(userId);
    expect(membership).toBeUndefined();

    const tags = await userTagsService.getByUser(userId);
    expect(tags).toHaveLength(0);
  });
});

describe("qualificationsService.getPendingApplications", () => {
  it("returns only pending rows", async () => {
    const { userId, cleanup } = createTestUser();
    const { userId: adminId, cleanup: ac } = createTestUser();
    cleanups.push(cleanup, ac);
    const { typeId, cleanup: tc } = createTestQualificationType();
    cleanups.push(tc);

    const q = await qualificationsService.upsert(userId, typeId);
    cleanupQualIds.push(q.id);

    const pending = await qualificationsService.getPendingApplications();
    expect(pending.map((p) => p.id)).toContain(q.id);

    await qualificationsService.approve(q.id, adminId);
    const pendingAfter = await qualificationsService.getPendingApplications();
    expect(pendingAfter.map((p) => p.id)).not.toContain(q.id);

    const db = openDb();
    db.prepare("DELETE FROM user_tags WHERE user_id = ?").run(userId);
    db.prepare("DELETE FROM user_memberships WHERE user_id = ?").run(userId);
    db.close();
  });
});
