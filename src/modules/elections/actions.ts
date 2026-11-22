import { routeAction$, z, zod$ } from "@qwik.dev/router";
import { itemUrl, requireModuleAuth, t } from "~/core";
import { submitApplicationForReview } from "./review";
import { electionsService } from "./service";

export const useSubmitApplication = routeAction$(
	async (data, event) => {
		const user = await requireModuleAuth(event, "elections");
		const result = await electionsService.createApplication({
			positionId: data.positionId,
			cycleId: data.cycleId,
			userId: user.id,
			motivationWhy: data.motivationWhy,
			motivationExperience: data.motivationExperience,
			motivationGoals: data.motivationGoals,
		});
		if (result.error || !result.application)
			return { failed: true, error: result.error };
		// Waits in the Reviews queue of the election's scope.
		await submitApplicationForReview(user.id, result.application);
		const cycle = await electionsService.getCycleById(data.cycleId);
		throw event.redirect(
			302,
			cycle ? await itemUrl("elections:cycle", cycle) : "/elections",
		);
	},
	zod$({
		positionId: z.string().uuid(),
		cycleId: z.string().uuid(),
		motivationWhy: z
			.string()
			.min(10, t("elections.actions.pleaseWriteAtLeastA")),
		motivationExperience: z
			.string()
			.min(10, t("elections.actions.pleaseWriteAtLeastA")),
		motivationGoals: z
			.string()
			.min(10, t("elections.actions.pleaseWriteAtLeastA")),
	}),
);
