/**
 * The onboarding form for the seeds (spec 4.10). The workflow-form helper is core's
 * (`ensureWorkflowForm` in src/core/db/seed.ts); module forms are seeded by their modules.
 */
import fs from "fs";
import type { WorkflowFormSeed } from "../src/core/db/seed.ts";

export { ensureWorkflowForm } from "../src/core/db/seed.ts";

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
