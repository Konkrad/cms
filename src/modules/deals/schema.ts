import crypto from "crypto";
import { type InferSelectModel, sql } from "drizzle-orm";
import { sqliteTable, text } from "drizzle-orm/sqlite-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";
import { defineModuleSchema, scopes } from "~/core/schema";

export interface DealStep {
	type: "text" | "link" | "promo";
	title: string;
	text: string;
	link?: string;
	linkText?: string;
	promoCode?: string;
	requiresLogin?: boolean;
}

export const deals = sqliteTable("deals", {
	id: text("id").primaryKey(),
	name: text("name").notNull(),
	description: text("description"),
	logo: text("logo"),
	validUntil: text("valid_until"),
	steps: text("steps", { mode: "json" })
		.$type<DealStep[]>()
		.notNull()
		.default([]),
	// Owning scope (spec 4.2: every scoped content row has one; site-wide = the root).
	scopeId: text("scope_id")
		.notNull()
		.references(() => scopes.id, { onDelete: "cascade" }),
	createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
	updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

const baseInsertSchema = createInsertSchema(deals);
const baseSelectSchema = createSelectSchema(deals);

export const insertDealSchema = baseInsertSchema.extend({
	id: z
		.string()
		.uuid()
		.default(() => crypto.randomUUIDv7()),
	validUntil: z
		.union([
			z.null(),
			z.undefined(),
			z.coerce.date().transform((d) => d.toISOString()),
		])
		.optional(),
	steps: z
		.array(
			z.object({
				type: z.enum(["text", "link", "promo"]),
				title: z.string().min(1),
				text: z.string(),
				link: z.string().url().optional(),
				linkText: z.string().optional(),
				promoCode: z.string().optional(),
				requiresLogin: z.boolean().optional(),
			}),
		)
		.default([]),
});

export const updateDealSchema = baseInsertSchema
	.extend({
		validUntil: z
			.union([
				z.null(),
				z.undefined(),
				z.coerce.date().transform((d) => d.toISOString()),
			])
			.optional(),
		steps: z
			.array(
				z.object({
					type: z.enum(["text", "link", "promo"]),
					title: z.string().min(1),
					text: z.string(),
					link: z.string().url().optional(),
					linkText: z.string().optional(),
					promoCode: z.string().optional(),
					requiresLogin: z.boolean().optional(),
				}),
			)
			.optional(),
	})
	.partial()
	.omit({ id: true, scopeId: true });

export default defineModuleSchema({
	tables: { deals },
	relations: () => ({}),
});

export type Deal = InferSelectModel<typeof deals>;
export type InsertDeal = z.infer<typeof insertDealSchema>;
export type UpdateDeal = z.infer<typeof updateDealSchema>;
