import { eq, inArray, isNull } from "drizzle-orm";
import { db } from "~/core/db/connection";
import {
	type Group,
	groups,
	type InsertGroup,
	insertGroupSchema,
	updateGroupSchema,
} from "~/core/db/schema";
import { generateSlug } from "~/core/scopes/group-slug";
import { groupMemberships } from "~/core/scopes/schema/group-memberships";
import { groupRepresentatives } from "~/core/scopes/schema/group-representatives";

export const groupsService = {
	/**
	 * userId -> public group label: "Local Rep <group>" for representatives, otherwise
	 * the name of a group the user belongs to. Users without a group are absent.
	 */
	async getGroupLabels(userIds: string[]): Promise<Record<string, string>> {
		const labels: Record<string, string> = {};
		if (userIds.length === 0) return labels;
		const repRows = await db
			.select({
				userId: groupRepresentatives.userId,
				groupName: groups.name,
			})
			.from(groupRepresentatives)
			.innerJoin(groups, eq(groupRepresentatives.groupId, groups.id))
			.where(inArray(groupRepresentatives.userId, userIds));
		for (const rep of repRows)
			labels[rep.userId] = `Local Rep ${rep.groupName}`;

		const missing = userIds.filter((id) => !labels[id]);
		if (missing.length > 0) {
			const memberRows = await db
				.select({ userId: groupMemberships.userId, groupName: groups.name })
				.from(groupMemberships)
				.innerJoin(groups, eq(groupMemberships.groupId, groups.id))
				.where(inArray(groupMemberships.userId, missing));
			for (const mem of memberRows) {
				if (!labels[mem.userId]) labels[mem.userId] = mem.groupName;
			}
		}
		return labels;
	},

	async getAll(): Promise<Group[]> {
		return await db.select().from(groups).orderBy(groups.name);
	},

	async getById(id: string): Promise<Group | null> {
		const results = await db
			.select()
			.from(groups)
			.where(eq(groups.id, id))
			.limit(1);
		return results[0] || null;
	},

	async getBySlug(slug: string): Promise<Group | null> {
		const results = await db
			.select()
			.from(groups)
			.where(eq(groups.slug, slug))
			.limit(1);
		return results[0] || null;
	},

	async create(data: InsertGroup): Promise<Group> {
		const validated = await insertGroupSchema.parseAsync(data);

		if (!validated.slug) {
			validated.slug = generateSlug(validated.name);
		}

		const [group] = await db
			.insert(groups)
			.values(validated as any)
			.returning();
		return group;
	},

	async update(id: string, data: unknown): Promise<Group> {
		const validated = await updateGroupSchema.parseAsync(data);

		if (validated.name && !validated.slug) {
			validated.slug = generateSlug(validated.name);
		}

		validated.updatedAt = new Date().toISOString();

		const [updated] = await db
			.update(groups)
			.set(validated)
			.where(eq(groups.id, id))
			.returning();
		return updated;
	},
};
