import { $, component$, useSignal, useVisibleTask$ } from "@qwik.dev/core";
import { useNavigate } from "@qwik.dev/router";
import { Button } from "~/components/ui/Button";
import { SetupLayout } from "~theme/shared/SetupLayout/SetupLayout";
import { ProfileStep } from "~theme/shared/ProfileStep/ProfileStep";
import { LocationStep } from "~theme/shared/LocationStep/LocationStep";
import { SurveyRuntime } from "~/components/forms/SurveyRuntime";
import type {
  MarkLocationAction,
  OnboardingViewData,
  UpdateProfileAction,
} from "~/contracts/onboarding";

/** Themed view for the post-login onboarding wizard (`/profile/setup`). */
export const OnboardingView = component$<{
  loader: OnboardingViewData;
  updateAction: UpdateProfileAction;
  markLocation: MarkLocationAction;
}>(({ loader, updateAction, markLocation }) => {
  const saveTrigger = useSignal(0);
  const nav = useNavigate();

  const { user, consent, form, existingFormResult } = loader;
  const needsProfile = !consent.lastProfileUpdate;
  const needsLocation = !consent.locationVerification;
  const needsSurvey = !consent.survey;

  // Determine initial phase based on what's already complete.
  const phase = useSignal<"steps" | "survey" | "done">(
    needsProfile || needsLocation ? "steps" : needsSurvey ? "survey" : "done",
  );

  // After profile + location actions complete, advance to survey (or home).
  useVisibleTask$(({ track }) => {
    track(() => updateAction.value);
    track(() => markLocation.value);

    if (phase.value === "done") {
      void nav("/");
      return;
    }

    const profileOk = !needsProfile || !!updateAction.value?.success;
    const locationOk = !needsLocation || !!markLocation.value?.success;

    // Once profile saves, auto-trigger location save so both complete together.
    if (needsLocation && updateAction.value?.success && !markLocation.value?.success) {
      saveTrigger.value++;
    }

    if (profileOk && locationOk) {
      if (form && needsSurvey) {
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
      {phase.value === "done" ? null : phase.value === "survey" ? (
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
