import type { z } from "zod";
import type { RequirementStepData } from "~/contracts/requirements";
import { t } from "~/core/i18n";
import {
	isOutdated,
	type RequirementDefinition,
	RequirementInputError,
	type RequirementUser,
	toStepData,
} from "./define";
import { requirementsService } from "./requirements.service";

/** A requirement the user still has to complete in a context. */
export interface PendingRequirement {
	id: string;
	title: string;
	version: number;
}

/** First problem per top-level field name. */
function fieldErrorsOf(error: z.ZodError): Record<string, string> {
	const errors: Record<string, string> = {};
	for (const issue of error.issues) {
		const key = issue.path.length ? String(issue.path[0]) : "_";
		errors[key] ??= issue.message;
	}
	return errors;
}

/**
 * The requirements API (spec 4.6) over a list of definitions (core plus the active modules', see
 * `src/core/registry/requirements.ts`), or a getter for it: the registry resolves it on first use
 * because the module manifests import `~/core`, which exports this API. Server-only.
 */
export function createRequirementsApi(
	source:
		| readonly RequirementDefinition[]
		| (() => readonly RequirementDefinition[]),
) {
	let resolved: readonly RequirementDefinition[] | undefined;
	const definitions = () => {
		resolved ??= typeof source === "function" ? source() : source;
		return resolved;
	};
	const byId = (id: string) => definitions().find((d) => d.id === id);

	/** Definitions checked in `context` that apply to the user, in declaration order. */
	async function applicable(user: RequirementUser, context: string) {
		const inContext = definitions().filter((d) => d.contexts.includes(context));
		const checks = await Promise.all(
			inContext.map(async (d) =>
				d.isApplicable ? d.isApplicable(user) : true,
			),
		);
		return inContext.filter((_, i) => checks[i]);
	}

	async function pendingWithRows(user: RequirementUser, context: string) {
		const defs = await applicable(user, context);
		const rows = await requirementsService.rowsFor(
			user.id,
			defs.map((d) => d.id),
		);
		const rowOf = new Map(rows.map((r) => [r.requirementId, r]));
		return defs
			.filter((d) => isOutdated(d, rowOf.get(d.id)))
			.map((def) => ({ def, row: rowOf.get(def.id) }));
	}

	return {
		/** Ids of every requirement in force (core and active modules). */
		ids: (): string[] => definitions().map((d) => d.id),

		/**
		 * Requirements of `context` the user has not completed at their current version, in
		 * declaration order (core first). Empty = nothing to ask.
		 */
		async pending(
			user: RequirementUser,
			context: string,
		): Promise<PendingRequirement[]> {
			return (await pendingWithRows(user, context)).map(({ def }) => ({
				id: def.id,
				title: def.title,
				version: def.version,
			}));
		},

		/**
		 * The pending steps of `context` as the theme renders them, prefilled with the user's
		 * OWN data (their previous answer when a version bump asks again). Never pass another
		 * user here.
		 */
		async steps(
			user: RequirementUser,
			context: string,
		): Promise<RequirementStepData[]> {
			const pending = await pendingWithRows(user, context);
			return Promise.all(
				pending.map(async ({ def, row }) => {
					const previous = row?.value ?? null;
					const prefill = def.prepare
						? await def.prepare(user, previous)
						: {
								values:
									previous && typeof previous === "object"
										? (previous as Record<string, unknown>)
										: {},
							};
					return toStepData(def, prefill);
				}),
			);
		},

		/**
		 * Validates one step on the server with the requirement's schema, applies it (`save`) and
		 * stores the completion at the current version. Throws `RequirementInputError` for an
		 * unknown, inactive or not applicable requirement and for invalid input (nothing stored).
		 */
		async submit(
			user: RequirementUser,
			requirementId: string,
			input: unknown,
		): Promise<void> {
			const def = byId(requirementId);
			if (!def)
				throw new RequirementInputError(t("core.requirements.unknownStep"));
			if (def.isApplicable && !(await def.isApplicable(user)))
				throw new RequirementInputError(
					t("core.requirements.stepDoesNotApply"),
				);
			const parsed = def.input.safeParse(input ?? {});
			if (!parsed.success)
				throw new RequirementInputError(
					t("core.requirements.checkAnswers"),
					fieldErrorsOf(parsed.error),
				);
			const value = def.save ? await def.save(user, parsed.data) : parsed.data;
			await requirementsService.complete(user.id, def.id, def.version, value);
		},
	};
}

export type RequirementsApi = ReturnType<typeof createRequirementsApi>;
