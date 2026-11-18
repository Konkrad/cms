import { sql } from "drizzle-orm";
import { index, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { users } from "../../users/schema";
import { forms } from "./forms";

/** Validated answers by question name. Free text is plain text, never rendered as HTML. */
export type FormAnswers = Record<string, unknown>;

/**
 * One submission of a form (spec 4.10). `subjectRef` attaches the answers to an item
 * (`events:event:<id>` for a proposal or a debrief); null for surveys and onboarding.
 */
export const formResults = sqliteTable(
	"form_results",
	{
		id: text("id").primaryKey(),
		formId: text("form_id")
			.notNull()
			.references(() => forms.id, { onDelete: "cascade" }),
		userId: text("user_id").references(() => users.id, {
			onDelete: "cascade",
		}),
		subjectRef: text("subject_ref"),
		answers: text("answers", { mode: "json" }).$type<FormAnswers>().notNull(),
		altchaPayload: text("altcha_payload"),
		createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
	},
	(table) => [
		index("form_results_form_idx").on(table.formId, table.createdAt),
		index("form_results_user_idx").on(table.userId, table.createdAt),
		index("form_results_subject_idx").on(table.subjectRef),
	],
);

export type FormResult = typeof formResults.$inferSelect;
export type NewFormResult = typeof formResults.$inferInsert;
