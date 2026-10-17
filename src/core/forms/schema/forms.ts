import { sql } from "drizzle-orm";
import {
	index,
	integer,
	primaryKey,
	sqliteTable,
	text,
} from "drizzle-orm/sqlite-core";
import { scopes } from "../../scopes/schema/scopes";
import { users } from "../../users/schema";

/** A SurveyJS form definition (`pages[].elements[]` of questions). */
export type FormSchema = Record<string, any>;

/**
 * A form (spec 4.10), owned by a scope (site-wide forms belong to the root). The question
 * schema is SurveyJS JSON, edited in the admin form builder. `purpose` marks a form used by a
 * workflow (`core.onboarding`, `events.proposal`, …; declared by core or a module manifest's
 * `forms`); the active form of a purpose is picked per scope in `form_assignments`. A form
 * with at least one result is locked: its schema can no longer change (duplicate it instead).
 */
export const forms = sqliteTable(
	"forms",
	{
		id: text("id").primaryKey(),
		scopeId: text("scope_id")
			.notNull()
			.references(() => scopes.id, { onDelete: "cascade" }),
		title: text("title").notNull(),
		slug: text("slug").notNull(),
		description: text("description"),
		schema: text("schema", { mode: "json" }).$type<FormSchema>().notNull(),
		purpose: text("purpose"),
		// Public survey pages: "private" needs a login, "public" takes guest answers (ALTCHA).
		visibility: text("visibility", { enum: ["private", "public"] })
			.notNull()
			.default("private"),
		// A user may change their answers (the onboarding survey); otherwise one answer per user.
		allowResubmission: integer("allow_resubmission", { mode: "boolean" })
			.notNull()
			.default(false),
		createdBy: text("created_by").references(() => users.id, {
			onDelete: "set null",
		}),
		createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
		updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
	},
	(table) => [
		index("forms_scope_idx").on(table.scopeId),
		index("forms_purpose_idx").on(table.purpose),
	],
);

/**
 * The active form of a purpose in a scope; the nearest scope up the tree with an assignment
 * wins (`formAssignmentsService.activeFor`). One row per purpose and scope.
 */
export const formAssignments = sqliteTable(
	"form_assignments",
	{
		purpose: text("purpose").notNull(),
		scopeId: text("scope_id")
			.notNull()
			.references(() => scopes.id, { onDelete: "cascade" }),
		formId: text("form_id")
			.notNull()
			.references(() => forms.id, { onDelete: "cascade" }),
		updatedAt: text("updated_at").notNull(),
	},
	(table) => [primaryKey({ columns: [table.purpose, table.scopeId] })],
);

export type Form = typeof forms.$inferSelect;
export type NewForm = typeof forms.$inferInsert;
export type FormAssignment = typeof formAssignments.$inferSelect;
