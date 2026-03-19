import { component$, useSignal, useVisibleTask$ } from "@builder.io/qwik";
import { routeAction$, routeLoader$, z, zod$ } from "@builder.io/qwik-city";
import { eq } from "drizzle-orm";
import { OnboardingLayout } from "~/components/onboarding/OnboardingLayout";
import { ProfileStep } from "~/components/onboarding/ProfileStep";
import { SurveyRuntime } from "~/components/forms/SurveyRuntime";
import { db } from "~/db/connection";
import { users } from "~/db/schema";
import { getCurrentUserData, requireAuth } from "~/utils/server-auth";
import { formsService } from "~/services/forms.service";

export const useOnboardingLoader = routeLoader$(async (event) => {
  await requireAuth(event);
  const user = await getCurrentUserData(event);
  if (!user) {
    throw event.redirect(302, "/login");
  }

  // Load the onboarding form that is configured as a system form.
  const form = await formsService.getBySystemKey("affilation");

  return { user, form };
});

export const useUpdateProfile = routeAction$(
  async (data, event) => {
    const user = await requireAuth(event);
    const currentUser = await getCurrentUserData(event);

    if (!currentUser) {
      return { success: false, error: "User not found" };
    }

    const updateData: any = {
      name: data.name,
      familyName: data.family_name,
      city: data.city || null,
      country: data.country || null,
      yearOfBirth: data.year_of_birth ?? null,
      sex: data.sex ?? null,
      updatedAt: new Date().toISOString(),
    };

    try {
      await db
        .update(users)
        .set(updateData)
        .where(eq(users.id, currentUser.id));

      return { success: true };
    } catch (err: any) {
      return {
        success: false,
        error: err?.message || "Failed to update profile",
      };
    }
  },
  zod$({
    name: z.string().min(1, "Name is required"),
    family_name: z.string().min(1, "Family name is required"),
    city: z.string().optional(),
    country: z.string().optional(),
    year_of_birth: z.coerce.number().optional(),
    sex: z.string().optional(),
  }),
);

export default component$(() => {
  const loader = useOnboardingLoader();
  const updateAction = useUpdateProfile();
  const showForm = useSignal(false);

  useVisibleTask$(({ track }) => {
    track(() => updateAction.value?.success);
    if (updateAction.value?.success) {
      showForm.value = true;
    }
  });

  if (!loader.value.form) {
    return (
      <OnboardingLayout
        title="Complete your profile"
        description="No onboarding form is configured. Please contact the administrator."
      >
        <div class="p-4 bg-yellow-50 border border-yellow-200 rounded">
          <p class="text-sm text-yellow-800">
            The onboarding questionnaire is not available right now.
          </p>
        </div>
      </OnboardingLayout>
    );
  }

  return (
    <OnboardingLayout
      title="Complete your profile"
      description="Fill in your details and continue to the next step."
    >
      {showForm.value ? (
        <SurveyRuntime
          surveyJson={loader.value.form.schemaJson}
          formId={loader.value.form.id}
          submitUrl="/api/onboarding/form-submit"
          requireAltcha={false}
        />
      ) : (
        <ProfileStep
          profile={loader.value.user}
          updateAction={updateAction}
        />
      )}
    </OnboardingLayout>
  );
});
