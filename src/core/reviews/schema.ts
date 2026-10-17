import { sql } from "drizzle-orm";
import { index, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { scopes } from "../scopes/schema/scopes";
import { users } from "../users/schema";

export const REVIEW_STATUSES = [
	"draft",
	"in_review",
	"approved",
	"rejected",
] as const;
export type ReviewStatus = (typeof REVIEW_STATUSES)[number];

/**
 * One row per submission of an item for review (spec 4.9), so the history is kept: a rejected
 * item that is resubmitted gets a new row. `ref` is the item (`events:event:<id>`,
 * `core:note:<id>`), `scopeId` its owning scope at submission, `data` the answers of an
 * attached form (an event proposal), also stored as a form result by ref.
 */
export const reviews = sqliteTable(
	"reviews",
	{
		id: text("id").primaryKey(),
		ref: text("ref").notNull(),
		scopeId: text("scope_id")
			.notNull()
			.references(() => scopes.id, { onDelete: "cascade" }),
		status: text("status", { enum: REVIEW_STATUSES })
			.notNull()
			.default("in_review"),
		submittedBy: text("submitted_by")
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),
		reviewedBy: text("reviewed_by").references(() => users.id, {
			onDelete: "set null",
		}),
		comment: text("comment"),
		data: text("data", { mode: "json" }).$type<Record<string, unknown>>(),
		formId: text("form_id"),
		createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
		decidedAt: text("decided_at"),
	},
	(t) => [
		index("reviews_ref_idx").on(t.ref, t.createdAt),
		index("reviews_status_scope_idx").on(t.status, t.scopeId),
	],
);

export type Review = typeof reviews.$inferSelect;
