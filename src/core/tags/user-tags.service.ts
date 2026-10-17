import crypto from "crypto";
import { and, eq } from "drizzle-orm";
import { db } from "~/core/db/connection";
import {
	insertTagDefinitionSchema,
	type TagDefinition,
	tagDefinitions,
	updateTagDefinitionSchema,
} from "~/core/tags/schema/tag-definitions";
import {
	insertUserTagSchema,
	type UserTag,
	userTags,
} from "~/core/tags/schema/user-tags";

export const userTagsService = {
	async getByUser(userId: string): Promise<UserTag[]> {
		return db.query.userTags.findMany({
			where: { userId },
			orderBy: { grantedAt: "desc" },
		});
	},

	async getAll(): Promise<UserTag[]> {
		return db.query.userTags.findMany({ orderBy: { grantedAt: "desc" } });
	},

	async grant(
		userId: string,
		slug: string,
		label: string,
		category: "board" | "qualification" | "participation" | "custom",
		sourceType: "manual" | "qualification" | "election" | "rule",
		sourceId?: string,
		grantedBy?: string,
	): Promise<UserTag> {
		const [existing] = await db
			.select()
			.from(userTags)
			.where(and(eq(userTags.userId, userId), eq(userTags.slug, slug)))
			.limit(1);
		if (existing) return existing;

		const validated = insertUserTagSchema.parse({
			id: crypto.randomUUID(),
			userId,
			slug,
			label,
			category,
			sourceType,
			sourceId: sourceId ?? null,
			grantedBy: grantedBy ?? null,
		});
		const [row] = await db
			.insert(userTags)
			.values(validated as any)
			.returning();
		return row;
	},

	async adminGrant(
		userId: string,
		slug: string,
		label: string,
		category: "board" | "qualification" | "participation" | "custom",
		adminUserId: string,
	): Promise<UserTag> {
		return this.grant(
			userId,
			slug,
			label,
			category,
			"manual",
			undefined,
			adminUserId,
		);
	},

	async revoke(userId: string, slug: string): Promise<void> {
		await db
			.delete(userTags)
			.where(and(eq(userTags.userId, userId), eq(userTags.slug, slug)));
	},

	// ── Tag definitions ────────────────────────────────────────────────────────

	async getDefinitions(): Promise<TagDefinition[]> {
		return db.query.tagDefinitions.findMany({
			orderBy: { label: "asc" },
		});
	},

	async createDefinition(data: {
		slug: string;
		label: string;
		category: "board" | "qualification" | "participation" | "custom";
		description?: string;
	}): Promise<TagDefinition> {
		const validated = insertTagDefinitionSchema.parse({
			id: crypto.randomUUID(),
			...data,
		});
		const [row] = await db
			.insert(tagDefinitions)
			.values(validated as any)
			.returning();
		return row;
	},

	async updateDefinition(
		id: string,
		data: Partial<{
			slug: string;
			label: string;
			category: string;
			description: string | null;
		}>,
	): Promise<TagDefinition> {
		const validated = updateTagDefinitionSchema.parse(data);
		const [row] = await db
			.update(tagDefinitions)
			.set({ ...validated, updatedAt: new Date().toISOString() } as any)
			.where(eq(tagDefinitions.id, id))
			.returning();
		return row;
	},

	async deleteDefinition(id: string): Promise<void> {
		await db.delete(tagDefinitions).where(eq(tagDefinitions.id, id));
	},

	async grantFromDefinition(
		userId: string,
		definitionId: string,
		adminUserId: string,
	): Promise<UserTag | null> {
		const def = await db.query.tagDefinitions.findFirst({
			where: { id: definitionId },
		});
		if (!def) return null;
		return this.grant(
			userId,
			def.slug,
			def.label,
			def.category,
			"manual",
			definitionId,
			adminUserId,
		);
	},
};
