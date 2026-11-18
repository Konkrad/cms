/**
 * Core → theme contract for user requirement steps (spec 4.6): the setup flow (`/profile/setup`)
 * and pages that check a context (event checkout) render pending steps with these types and
 * submit each one through core's single `useSubmitRequirement` action.
 */
import type { useSubmitRequirement } from "~/core/requirements/useSubmitRequirement";

/** A generic field of a step (when the requirement has no custom view). */
export type RequirementField =
	| {
			name: string;
			label: string;
			type: "radio" | "select";
			options: Array<{ value: string; label: string; description?: string }>;
			required?: boolean;
	  }
	| {
			name: string;
			label: string;
			type: "text" | "textarea";
			required?: boolean;
			maxLength?: number;
	  }
	| { name: string; label: string; type: "checkbox"; required?: boolean };

/** One pending step as the theme renders it. */
export interface RequirementStepData {
	/** Requirement id, posted back as `requirementId`. */
	id: string;
	title: string;
	description: string | null;
	/** Custom view (`core.profile`, `core.location`, `core.form`) or null for `fields`. */
	view: string | null;
	fields: RequirementField[];
	/** The viewer's OWN current values, to prefill the step. */
	values: Record<string, unknown>;
	/** Extra data for a custom view (the onboarding survey's questions). */
	data: Record<string, unknown> | null;
}

/** Core's single step action (`useSubmitRequirement`), passed to the steps by the route/view. */
export type SubmitRequirementAction = ReturnType<typeof useSubmitRequirement>;
