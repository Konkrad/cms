import { eq, isNull } from "drizzle-orm";
import { db } from "~/core/db/connection";
import {
	type Group,
	groups,
	type InsertGroup,
	insertGroupSchema,
	updateGroupSchema,
} from "~/core/db/schema";
import { generateSlug } from "~/utils/group-slug";

export const groupsService = {
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
