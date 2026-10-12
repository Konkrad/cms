/**
 * Workflow forms for the seeds (spec 4.10): a form with a purpose, owned by a scope and made the
 * active form of that purpose there (`form_assignments`). Shared by scripts/seed.ts and
 * scripts/seed-test.ts; raw SQL so it works with either script's Drizzle instance.
 */
import type Database from "better-sqlite3";
import crypto from "crypto";
import fs from "fs";

export interface WorkflowFormSeed {
	purpose: string;
	title: string;
	slug: string;
	description: string;
	schema: Record<string, unknown>;
	allowResubmission?: boolean;
}

/**
 * The active form of `purpose` on `scopeId`, created and assigned when the scope has none yet
 * (idempotent: an existing assignment is kept). Returns the form id.
 */
export function ensureWorkflowForm(
	sqlite: Database.Database,
	scopeId: string,
	createdBy: string | null,
	form: WorkflowFormSeed,
): string {
	const assigned = sqlite
		.prepare(
			"SELECT form_id AS formId FROM form_assignments WHERE purpose = ? AND scope_id = ?",
		)
		.get(form.purpose, scopeId) as { formId: string } | undefined;
	if (assigned) return assigned.formId;
	const id = crypto.randomUUID();
	const now = new Date().toISOString();
	sqlite
		.prepare(
			`INSERT INTO forms (id, scope_id, title, slug, description, schema, purpose, visibility,
			 allow_resubmission, created_by, created_at, updated_at)
			 VALUES (?, ?, ?, ?, ?, ?, ?, 'private', ?, ?, ?, ?)`,
		)
		.run(
			id,
			scopeId,
			form.title,
			form.slug,
			form.description,
			JSON.stringify(form.schema),
			form.purpose,
			form.allowResubmission ? 1 : 0,
			createdBy,
			now,
			now,
		);
	sqlite
		.prepare(
			"INSERT INTO form_assignments (purpose, scope_id, form_id, updated_at) VALUES (?, ?, ?, ?)",
		)
		.run(form.purpose, scopeId, id, now);
	return id;
}

/** The onboarding survey every new user fills in (`/profile/setup`), from surveys/onboard.json. */
export const onboardingFormSeed = (): WorkflowFormSeed => ({
	purpose: "core.onboarding",
	title: "Onboarding Survey",
	slug: "onboarding",
	description:
		"Required during signup — captures how you know us and your academic background.",
	schema: JSON.parse(fs.readFileSync("surveys/onboard.json", "utf-8")),
	allowResubmission: true,
});
