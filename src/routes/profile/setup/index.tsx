import { component$ } from "@qwik.dev/core";
import { routeLoader$ } from "@qwik.dev/router";
import { getCurrentUserData, requireAuth } from "~/core/auth/server-auth";
import { formResultsService } from "~/core/forms/form-results.service";
import { formAssignmentsService } from "~/core/forms/forms.service";
import { ONBOARDING_PURPOSE } from "~/core/forms/purposes";
import { resolvePrivateImageUrl } from "~/core/media/secure-urls";
import { getRootScope } from "~/core/scopes/access";
import type { UserConsent } from "~/core/users/schema";
import { OnboardingView } from "~theme/routes/onboarding/OnboardingView";
import { useMarkLocation } from "../../../core/users/setup/LocationStep/useMarkLocation";
// Import re-exported route actions via a RELATIVE path, not the "~"/"~theme" alias —
// qwikRouter's production transform for re-exported routeAction$/routeLoader$ does
// not resolve either tsconfig alias, so the Rollup build fails to find the module.
// The presentational ProfileStep/LocationStep widgets themselves (no actions) are
// imported by the theme view via the "~theme" alias, since that transform only
// affects actions.
import { useUpdateProfile } from "../../../core/users/setup/ProfileStep/useUpdateProfile";

// Re-export so Qwik City registers the actions for this route.
export { useUpdateProfile, useMarkLocation };

export const useOnboardingLoader = routeLoader$(async (event) => {
	await requireAuth(event);
	const user = await getCurrentUserData(event);
	if (!user) {
		throw event.redirect(302, "/login");
	}

	const u = user as any;
	const consent = (u.consent ?? {}) as UserConsent;

	const root = await getRootScope();
	const active = root
		? await formAssignmentsService.activeFor(ONBOARDING_PURPOSE, root.id)
		: undefined;
	const form = active
		? { id: active.id, title: active.title, schemaJson: active.schema }
		: null;

	let existingFormResult: Record<string, any> | null = null;
	if (form) {
		const existing = await formResultsService.getByFormAndUser(
			form.id,
			user.id,
		);
		if (existing) existingFormResult = existing.answers as Record<string, any>;
	}

	const profilePictureUrl = u.profilePicture
		? await resolvePrivateImageUrl(u.profilePicture)
		: null;

	return {
		user: { ...user, profilePictureUrl } as any,
		consent,
		form,
		existingFormResult,
	};
});

export default component$(() => {
	const loader = useOnboardingLoader();
	const updateAction = useUpdateProfile();
	const markLocation = useMarkLocation();

	return (
		<OnboardingView
			loader={loader.value}
			updateAction={updateAction}
			markLocation={markLocation}
		/>
	);
});
