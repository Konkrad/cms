import { component$ } from "@qwik.dev/core";
import { routeLoader$ } from "@qwik.dev/router";
import { formAccessService } from "~/services/form-access.service";
import { formResultsService } from "~/services/form-results.service";
import { formsService } from "~/services/forms.service";
import { getServerSession } from "~/utils/server-auth";
import { FormPageView } from "~theme/routes/forms/FormPageView";

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
  return <FormPageView data={data.value} />;
});
