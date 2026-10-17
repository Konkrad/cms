import crypto from "crypto";
import { sql } from "drizzle-orm";
import { sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";
import { scopes } from "../../scopes/schema/scopes";
import type { BlockData } from "./shared";

/**
 * A CMS page, owned by a scope and served under that scope's path by the catch-all:
 * `/<scope path>/<slug>` (`/about`, `/germany/berlin/about`). The root's page with the empty
 * slug is the site's home page. A slug is one URL segment.
 */
export const pages = sqliteTable(
	"pages",
	{
		id: text("id").primaryKey(),
		scopeId: text("scope_id")
			.notNull()
			.references(() => scopes.id),
		slug: text("slug").notNull(),
		title: text("title").notNull(),
		content: text("content", { mode: "json" }).$type<BlockData[]>(),
		status: text("status", { enum: ["draft", "published"] })
			.notNull()
			.default("draft"),
		createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
		updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
	},
	(table) => [
		uniqueIndex("pages_scope_slug_unique").on(table.scopeId, table.slug),
	],
);

const baseInsertSchema = createInsertSchema(pages);
const baseSelectSchema = createSelectSchema(pages);

export const insertPageSchema = baseInsertSchema
	.extend({
		id: z
			.string()
			.uuid()
			.default(() => crypto.randomUUID()),
		createdAt: z.string().default(() => new Date().toISOString()),
		updatedAt: z.string().default(() => new Date().toISOString()),
	})
	.partial({
		id: true,
		createdAt: true,
		updatedAt: true,
		status: true,
	});

export const updatePageSchema = baseInsertSchema
	.omit({
		id: true,
		createdAt: true,
	})
	.extend({
		updatedAt: z
			.string()
			.default(() => new Date().toISOString())
			.optional(),
	})
	.partial();

export const selectPageSchema = baseSelectSchema;

export type Page = Omit<z.infer<typeof selectPageSchema>, "content"> & {
	content: BlockData[] | null;
};
export type InsertPage = Omit<z.infer<typeof insertPageSchema>, "content"> & {
	content?: BlockData[] | null;
};
export type UpdatePage = Omit<z.infer<typeof updatePageSchema>, "content"> & {
	content?: BlockData[] | null;
};
