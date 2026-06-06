import { component$ } from "@qwik.dev/core";
import { routeLoader$ } from "@qwik.dev/router";
import { SurveyRuntime } from "~/components/forms/SurveyRuntime";
import { formAccessService } from "~/services/form-access.service";
import { formResultsService } from "~/services/form-results.service";
import { formsService } from "~/services/forms.service";
import { getServerSession } from "~/utils/server-auth";

export const useFormPage = routeLoader$(async (event) => {
  const form = await formsService.getByRouteSlug(event.params.formSlug);
  if (!form) {
    event.status(404);
    return null;
  }

  const user = await getServerSession(event);

  try {
    formAccessService.ensureViewAccess(form, user);
  } catch {
    throw event.redirect(302, "/login");
  }

  let existingResult: Record<string, any> | null = null;
  let alreadySubmitted = false;
  if (user) {
    const existing = await formResultsService.getByFormAndUser(form.id, user.id);
    if (existing) {
      alreadySubmitted = true;
      if (form.allowResubmission) existingResult = existing.resultJson as Record<string, any>;
    }
  }

  return {
    form,
    existingResult,
    alreadySubmitted,
    requireAltcha: formAccessService.requiresAltcha(form),
  };
});

export default component$(() => {
  const data = useFormPage();

  if (!data.value) {
    return (
      <div class="container mx-auto px-4 py-12 max-w-3xl">
        <h1 class="text-2xl font-semibold">Form not found</h1>
      </div>
    );
  }

  const { form, existingResult, alreadySubmitted, requireAltcha } = data.value;

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
