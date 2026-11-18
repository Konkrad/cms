import { t } from "~/core/i18n";
/**
 * Form purposes (spec 4.10): workflows that use a form whose questions admins edit in the form
 * builder. Core declares its own here; modules declare theirs in the manifest
 * (`forms: [{ purpose, label }]`). Client-safe.
 */
export interface FormPurpose {
	/** `<area>.<name>`, e.g. "events.proposal". */
	purpose: string;
	/** Shown in the forms admin ("Event proposal"). */
	label: string;
}

/** The onboarding survey every new user fills in (`/profile/setup`). */
export const ONBOARDING_PURPOSE = "core.onboarding";

export const coreFormPurposes: FormPurpose[] = [
	{ purpose: ONBOARDING_PURPOSE, label: t("core.forms.onboardingSurvey") },
];

/**
 * Whether a form is filled on its own survey page (`/forms/<id>-<slug>`, the survey block,
 * `/api/forms`): surveys (no purpose) and the onboarding survey, whose answers a user may
 * change later. Other workflow forms are filled inside their workflow (an event proposal).
 */
export const isSurveyForm = (form: { purpose: string | null }): boolean =>
	!form.purpose || form.purpose === ONBOARDING_PURPOSE;

const PURPOSE_PATTERN = /^[a-z0-9-]+\.[a-z0-9.-]+$/;

/** Purposes by id; throws on a malformed or duplicate purpose. */
export function indexFormPurposes(
	purposes: readonly FormPurpose[],
): Map<string, FormPurpose> {
	const byId = new Map<string, FormPurpose>();
	for (const p of purposes) {
		if (!PURPOSE_PATTERN.test(p.purpose))
			throw new Error(
				`Form purpose "${p.purpose}" must look like "<area>.<name>"`,
			);
		if (byId.has(p.purpose))
			throw new Error(`Duplicate form purpose: ${p.purpose}`);
		byId.set(p.purpose, p);
	}
	return byId;
}
