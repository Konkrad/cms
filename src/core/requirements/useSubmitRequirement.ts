import { routeAction$, z, zod$ } from "@qwik.dev/router";
import { requireAuth } from "~/core/auth/server-auth";
import { requirements } from "~/core/registry/requirements";
import { RequirementInputError } from "./define";

/**
 * Core's single step action (spec 4.6): submits one requirement step of the logged-in user,
 * whatever the page (`/profile/setup`, event checkout). The requirement's own schema validates
 * the fields on the server and the completion is stored at its current version. Re-export it
 * from a route via a RELATIVE path (Qwik production-build footgun); module views use it from
 * `~/core/setup-actions`.
 */
export const useSubmitRequirement = routeAction$(
	async (data, event) => {
		const user = await requireAuth(event);
		const { requirementId, ...fields } = data;
		try {
			await requirements.submit(user, requirementId, fields);
		} catch (err) {
			if (err instanceof RequirementInputError)
				return event.fail(400, {
					requirementId,
					message: err.message,
					fieldErrors: err.fieldErrors,
				});
			throw err;
		}
		return { success: true as const, requirementId };
	},
	// Only the step id is common; each requirement validates its own fields in `submit`.
	zod$(z.object({ requirementId: z.string().min(1).max(100) }).passthrough()),
);
