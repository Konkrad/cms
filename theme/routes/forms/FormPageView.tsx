import { component$ } from "@qwik.dev/core";
import { SurveyRuntime } from "~/components/forms/SurveyRuntime";
import type { FormPageViewData } from "~/contracts/forms";

/** Themed view for the public form submission route (`/forms/[formSlug]`). */
export const FormPageView = component$<{ data: FormPageViewData }>(({ data }) => {
  if (!data) {
    return (
      <div class="container mx-auto px-4 py-12 max-w-3xl">
        <h1 class="text-2xl font-semibold">Form not found</h1>
      </div>
    );
  }

  const { form, existingResult, alreadySubmitted, requireAltcha } = data;

  return (
    <div class="container mx-auto px-4 py-10 max-w-4xl">
      <section class="forms-page-header">
        <h1 class="forms-page-title">{form.title}</h1>
        {form.description && <p class="forms-page-description">{form.description}</p>}
      </section>

      {alreadySubmitted && !form.allowResubmission ? (
        <div class="forms-alert forms-alert-info">
          You already submitted this form. Multiple submissions are not allowed.
        </div>
      ) : (
        <>
          {existingResult && (
            <div class="forms-alert forms-alert-info">
              Your previous answers are pre-filled — submit again to update them.
            </div>
          )}
          <SurveyRuntime
            surveyJson={form.schemaJson as Record<string, any>}
            submitUrl={`/api/forms/${form.id}/submit`}
            requireAltcha={requireAltcha}
            initialData={existingResult ?? undefined}
          />
        </>
      )}
    </div>
  );
});
