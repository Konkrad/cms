import { component$ } from "@qwik.dev/core";
import { routeLoader$ } from "@qwik.dev/router";
// Import re-exported route actions via a RELATIVE path, not the "~"/"~theme" alias —
// qwikRouter's production transform for re-exported routeAction$/routeLoader$ does
// not resolve either tsconfig alias, so the Rollup build fails to find the module.
// The presentational ProfileStep/LocationStep widgets themselves (no actions) are
// imported by the theme view via the "~theme" alias, since that transform only
// affects actions.
import { useUpdateProfile } from "../../../components/setup/ProfileStep/useUpdateProfile";
import { useMarkLocation } from "../../../components/setup/LocationStep/useMarkLocation";
import { OnboardingView } from "~theme/routes/onboarding/OnboardingView";
import { getCurrentUserData, requireAuth } from "~/utils/server-auth";
import { formsService } from "~/services/forms.service";
import { formResultsService } from "~/services/form-results.service";
import { resolvePrivateImageUrl } from "~/utils/secure-urls";
import type { UserConsent } from "~/db/schemas/users";

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

  const form = await formsService.getBySystemKey("affilation");

  let existingFormResult: Record<string, any> | null = null;
  if (form) {
    const existing = await formResultsService.getByFormAndUser(form.id, user.id);
    if (existing) existingFormResult = existing.resultJson as Record<string, any>;
  }

  const profilePictureUrl = u.profilePicture
    ? await resolvePrivateImageUrl(u.profilePicture)
    : null;

  return { user: { ...user, profilePictureUrl } as any, consent, form, existingFormResult };
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
