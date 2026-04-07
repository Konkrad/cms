import { component$, useSignal, useVisibleTask$, $ } from "@builder.io/qwik";
import { routeLoader$, useNavigate } from "@builder.io/qwik-city";
import { SetupLayout } from "~/components/setup/SetupLayout";
import { useUpdateProfile, ProfileStep } from "~/components/setup/ProfileStep";
import { useMarkLocation, LocationStep } from "~/components/setup/LocationStep";
import { SurveyRuntime } from "~/components/forms/SurveyRuntime";
import { getCurrentUserData, requireAuth } from "~/utils/server-auth";
import { formsService } from "~/services/forms.service";
import { env } from "~/env";
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

  let profilePictureUrl: string | null = null;
  if (u.profilePicture) {
    const key = u.profilePicture.replace(/^\//, "");
    profilePictureUrl = env.AWS_ENDPOINT
      ? `${env.AWS_ENDPOINT}/${env.S3_BUCKET}/${key}`
      : `https://${env.S3_BUCKET}.s3.${env.AWS_REGION}.amazonaws.com/${key}`;
  }

  return { user: { ...user, profilePictureUrl } as any, consent, form };
});

export default component$(() => {
  const loader = useOnboardingLoader();
  const updateAction = useUpdateProfile();
  const markLocation = useMarkLocation();
  const showSurvey = useSignal(false);
  const saving = useSignal(false);
  const saveTrigger = useSignal(0);
  const nav = useNavigate();

  const { user, consent, form } = loader.value;
  const needsProfile = !consent.lastProfileUpdate;
  const needsLocation = !consent.locationVerification;

  useVisibleTask$(({ track }) => {
    track(() => updateAction.value);
    track(() => markLocation.value);

    if (!saving.value) return;

    const profileOk = !needsProfile || !!updateAction.value?.success;
    const locationOk = !needsLocation || !!markLocation.value?.success;

    if (profileOk && locationOk) {
      saving.value = false;
      if (form) {
        showSurvey.value = true;
      } else {
        nav("/");
      }
    }
  });

  return (
    <SetupLayout
      title="Complete your profile"
      description="Fill in your details to continue."
    >
      {showSurvey.value ? (
        <SurveyRuntime
          surveyJson={form!.schemaJson}
          submitUrl="/api/onboarding/form-submit"
          requireAltcha={false}
        />
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
            <button
              class="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
              onClick$={$(() => { saving.value = true; saveTrigger.value++; })}
            >
              Continue
            </button>
          </div>
        </div>
      )}
    </SetupLayout>
  );
});

