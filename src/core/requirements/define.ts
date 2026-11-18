import type { z } from "zod";
import type {
	RequirementField,
	RequirementStepData,
} from "~/contracts/requirements";

/**
 * User requirements (spec 4.6): something a user must complete or agree to before an action,
 * instead of a column on `users`. Core declares its own in `core-requirements.ts`; modules list
 * theirs in the manifest (`requirements: [...]`). Only core and active modules' requirements
 * apply. Completion is stored per user in `user_requirements` with the version completed;
 * bumping `version` makes a requirement pending again for everyone.
 */

/** Context checked by the root layout: pending requirements here block the whole site. */
export const GLOBAL_CONTEXT = "global";

/** Who a requirement is evaluated for (the logged-in user). */
export interface RequirementUser {
	id: string;
}

/** What a step shows before the user submits it (own data only; it reaches the browser). */
export interface RequirementPrefill {
	/** Initial field values, keyed by field name. */
	values?: Record<string, unknown>;
	/** Extra data for a custom `view` (e.g. the onboarding survey's questions). */
	data?: Record<string, unknown> | null;
}

export interface RequirementDefinition<I = unknown> {
	/** `<area>.<name>`: `core.profile`, or `<module id>.<name>` for a module's requirement. */
	id: string;
	/** Bump to ask everyone again: rows with a lower version count as pending. */
	version: number;
	/**
	 * Where the requirement is checked: `"global"` blocks the whole site (the root layout sends
	 * the user to `/profile/setup`); other contexts are checked by the page that names them
	 * (`"event.checkout"`). An empty list never blocks.
	 */
	contexts: readonly string[];
	title: string;
	description?: string;
	/**
	 * Server-side validation of the posted step (always required: the browser is not trusted).
	 * Field values arrive as strings from the form; coerce them here.
	 */
	input: z.ZodType<I>;
	/** Generic fields the theme renders when there is no custom `view`. */
	fields?: RequirementField[];
	/** A custom step view the theme provides (`core.profile`, `core.location`, `core.form`). */
	view?: string;
	/** Whether the requirement applies to the user at all (default: yes). */
	isApplicable?: (user: RequirementUser) => Promise<boolean> | boolean;
	/** Prefill and view data for the step; `previous` is the stored value of an older version. */
	prepare?: (
		user: RequirementUser,
		previous: unknown,
	) => Promise<RequirementPrefill> | RequirementPrefill;
	/**
	 * Applies the validated input (e.g. writes the profile to `users`) and returns the value to
	 * store in `user_requirements.value` (default: the validated input itself). Throw
	 * `RequirementInputError` for input that only the server can reject.
	 */
	// Method syntax (bivariant input) so a definition fits `RequirementDefinition` in lists.
	save?(user: RequirementUser, input: I): Promise<unknown>;
}

/** Bad input for a step: a message and a problem per field name, shown next to the step. */
export class RequirementInputError extends Error {
	constructor(
		message: string,
		readonly fieldErrors: Record<string, string> = {},
	) {
		super(message);
		this.name = "RequirementInputError";
	}
}

const ID_PATTERN = /^[a-z0-9-]+\.[a-zA-Z0-9.-]+$/;

export function defineRequirement<I>(
	def: RequirementDefinition<I>,
): RequirementDefinition<I> {
	if (!ID_PATTERN.test(def.id))
		throw new Error(
			`Requirement id "${def.id}" must look like "<area>.<name>"`,
		);
	if (!Number.isInteger(def.version) || def.version < 1)
		throw new Error(`Requirement "${def.id}": version must be an integer >= 1`);
	if (!def.input)
		throw new Error(`Requirement "${def.id}" has no input schema`);
	if (!def.view && !def.fields?.length)
		throw new Error(`Requirement "${def.id}" needs a view or fields`);
	return def;
}

/** Definitions by id; throws on a duplicate id. */
export function indexRequirements(
	defs: readonly RequirementDefinition[],
): Map<string, RequirementDefinition> {
	const byId = new Map<string, RequirementDefinition>();
	for (const def of defs) {
		if (byId.has(def.id))
			throw new Error(`Duplicate requirement id: ${def.id}`);
		byId.set(def.id, def);
	}
	return byId;
}

/** Whether a stored completion is missing or older than the definition's version. */
export const isOutdated = (
	def: Pick<RequirementDefinition, "version">,
	row: { version: number } | undefined,
): boolean => !row || row.version < def.version;

/** The step payload for the theme (no stored value besides the declared own prefill). */
export const toStepData = (
	def: RequirementDefinition,
	prefill: RequirementPrefill,
): RequirementStepData => ({
	id: def.id,
	title: def.title,
	description: def.description ?? null,
	view: def.view ?? null,
	fields: def.fields ?? [],
	values: prefill.values ?? {},
	data: prefill.data ?? null,
});
