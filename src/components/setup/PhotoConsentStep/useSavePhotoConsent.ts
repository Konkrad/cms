import { routeAction$, z, zod$ } from "@qwik.dev/router";
import { usersService } from "~/services/users.service";
import { markConsentStepComplete } from "~/utils/onboarding";
import { requireAuth } from "~/utils/server-auth";

/**
 * Co-located server action for the themed `PhotoConsentStep` widget
 * (`~theme/shared/PhotoConsentStep/PhotoConsentStep`) — re-export this from
 * any route that embeds it, via a RELATIVE import path (see
 * ../ProfileStep/useUpdateProfile.ts for why).
 * e.g. export { useSavePhotoConsent } from "../../../components/setup/PhotoConsentStep/useSavePhotoConsent";
 */
export const useSavePhotoConsent = routeAction$(
	async (data, event) => {
		const user = await requireAuth(event);
		await usersService.update(user.id, { photoConsentGiven: data.given });
		await markConsentStepComplete(user.id, "photoConsent");
		return { success: true };
	},
	zod$({
		// FormData values are always strings ("true"/"false" from PhotoConsentStep's
		// saveFn) — a plain z.boolean() rejects them, which silently broke this
		// action for every real submission, not just this recording.
		given: z.string().transform((val) => val === "true"),
	}),
);
