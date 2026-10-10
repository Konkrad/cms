import { afterEach, describe, expect, it, vi } from "vitest";
import { userTagsService } from "~/core/tags/user-tags.service";
import { createTestUser, openDb } from "./helpers";

const cleanupTagSlugs: Array<{ userId: string; slug: string }> = [];
const cleanups: (() => void)[] = [];

afterEach(() => {
	const db = openDb();
	for (const { userId, slug } of cleanupTagSlugs.splice(0)) {
		db.prepare("DELETE FROM user_tags WHERE user_id = ? AND slug = ?").run(
			userId,
			slug,
		);
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

		const tag = await userTagsService.grant(
			userId,
			"test-grant",
			"Test",
			"custom",
			"manual",
		);
		expect(tag.slug).toBe("test-grant");
		expect(tag.userId).toBe(userId);
	});

	it("is idempotent — calling twice returns same row", async () => {
		const { userId, cleanup } = createTestUser();
		cleanups.push(cleanup);
		cleanupTagSlugs.push({ userId, slug: "idem-tag" });

		const t1 = await userTagsService.grant(
			userId,
			"idem-tag",
			"Label",
			"custom",
			"manual",
		);
		const t2 = await userTagsService.grant(
			userId,
			"idem-tag",
			"Label",
			"custom",
			"manual",
		);

		expect(t1.id).toBe(t2.id);

		const db = openDb();
		const rows = db
			.prepare("SELECT * FROM user_tags WHERE user_id = ? AND slug = ?")
			.all(userId, "idem-tag");
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

		const tag = await userTagsService.adminGrant(
			userId,
			"admin-tag",
			"Admin Tag",
			"custom",
			adminId,
		);
		expect(tag.sourceType).toBe("manual");
		expect(tag.grantedBy).toBe(adminId);
	});
});

describe("userTagsService.revoke", () => {
	it("deletes the tag row", async () => {
		const { userId, cleanup } = createTestUser();
		cleanups.push(cleanup);

		await userTagsService.grant(
			userId,
			"revoke-me",
			"Revoke",
			"custom",
			"manual",
		);
		await userTagsService.revoke(userId, "revoke-me");

		const db = openDb();
		const row = db
			.prepare("SELECT * FROM user_tags WHERE user_id = ? AND slug = ?")
			.get(userId, "revoke-me");
		db.close();
		expect(row).toBeUndefined();
	});
});
