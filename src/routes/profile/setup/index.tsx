import { component$, useSignal, useVisibleTask$, $ } from "@qwik.dev/core";
import { routeLoader$, useNavigate } from "@qwik.dev/router";
import { Button } from "~/components/ui/Button";
import { SetupLayout } from "~/components/setup/SetupLayout";
// Import re-exported route actions via a RELATIVE path, not the "~" alias —
// qwikRouter's production transform for re-exported routeAction$/routeLoader$ does
// not resolve the tsconfig "~" alias, so the Rollup build fails to find the module.
import { useUpdateProfile, ProfileStep } from "../../../components/setup/ProfileStep/ProfileStep";
import { useMarkLocation, LocationStep } from "../../../components/setup/LocationStep/LocationStep";
import { SurveyRuntime } from "~/components/forms/SurveyRuntime";
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
  const saveTrigger = useSignal(0);
  const nav = useNavigate();

  const { user, consent, form, existingFormResult } = loader.value;
  const needsProfile = !consent.lastProfileUpdate;
  const needsLocation = !consent.locationVerification;

  // Determine initial phase based on what's already complete.
  const phase = useSignal<"steps" | "survey">(
    needsProfile || needsLocation ? "steps" : "survey",
  );

  // After profile + location actions complete, advance to survey (or home).
  useVisibleTask$(({ track }) => {
    track(() => updateAction.value);
    track(() => markLocation.value);

    const profileOk = !needsProfile || !!updateAction.value?.success;
    const locationOk = !needsLocation || !!markLocation.value?.success;

    // Once profile saves, auto-trigger location save so both complete together.
    if (needsLocation && updateAction.value?.success && !markLocation.value?.success) {
      saveTrigger.value++;
    }

    if (profileOk && locationOk) {
      if (form) {
        phase.value = "survey";
      } else {
        void nav("/");
      }
    }
  }, { strategy: "document-ready" });

  return (
    <SetupLayout
      title="Complete your profile"
      description="Fill in your details to continue."
    >
      {phase.value === "survey" ? (
        <>
          {existingFormResult && (
            <div class="mb-4 rounded-lg border border-border bg-bg-muted px-4 py-3 text-sm text-text-secondary">
              Your previous answers are pre-filled — submit again to update them.
            </div>
          )}
          <SurveyRuntime
            surveyJson={form!.schemaJson}
            submitUrl="/api/onboarding/form-submit"
            requireAltcha={false}
            initialData={existingFormResult ?? undefined}
            onComplete$={$(() => nav("/"))}
          />
        </>
      ) : (
        <div class="space-y-6">
          {needsProfile && (
            <ProfileStep
              profile={user}
              updateAction={updateAction}
              saveTrigger={saveTrigger}
            />
          )}
          {needsLocation && (
            <LocationStep
              isComplete={false}
              updateAction={markLocation}
              saveTrigger={saveTrigger}
            />
          )}
          <div class="pt-4">
            {needsProfile ? (
              <Button type="submit" form="profile-step-form">Continue</Button>
            ) : (
              <Button type="submit" form="location-step-form">Continue</Button>
            )}
          </div>
        </div>
      )}
    </SetupLayout>
  );
});
