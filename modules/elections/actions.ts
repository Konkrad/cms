import { routeAction$, z, zod$ } from "@qwik.dev/router";
import { requireModuleAuth } from "~/core";
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
		if (result.error) return { failed: true, error: result.error };
		throw event.redirect(302, `/elections/${data.cycleId}`);
	},
	zod$({
		positionId: z.string().uuid(),
		cycleId: z.string().uuid(),
		motivationWhy: z.string().min(10, "Please write at least a few sentences"),
		motivationExperience: z
			.string()
			.min(10, "Please write at least a few sentences"),
		motivationGoals: z
			.string()
			.min(10, "Please write at least a few sentences"),
	}),
);
