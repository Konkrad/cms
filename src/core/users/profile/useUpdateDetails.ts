import { routeAction$, z, zod$ } from "@qwik.dev/router";
import { requireAuth } from "~/core/auth/server-auth";
import { t } from "~/core/i18n";
import { isBirthPeriod } from "~/core/users/birth-period";
import { usersService } from "~/core/users/users.service";
import { env } from "~/env";

/**
 * Co-located server action for the themed `ProfileDetailsEdit` widget
 * (`~theme/shared/ProfileDetailsEdit/ProfileDetailsEdit`) — re-export this
 * from any route that embeds it, via a RELATIVE import path (see
 * useUpdateName.ts for why).
 * e.g. export { useUpdateDetails } from "../../core/users/profile/useUpdateDetails";
 */
export const useUpdateDetails = routeAction$(
	async (data, event) => {
		const user = await requireAuth(event);
		await usersService.update(user.id, {
			birthPeriod: data.birth_period ?? null,
			sex: data.sex || null,
		});
		return { success: true };
	},
	zod$({
		// The first year of a birth period offered on this site; empty = not given.
		birth_period: z
			.union([
				z.literal("").transform(() => undefined),
				z.coerce.number().int(),
			])
			.optional()
			.refine(
				(v) => v === undefined || isBirthPeriod(v, env.BIRTH_PERIOD_YEARS),
				t("core.requirements.profile.validBirthPeriod"),
			),
		sex: z.string().optional(),
	}),
);
