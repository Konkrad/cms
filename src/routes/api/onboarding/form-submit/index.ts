import { requireAuth } from "~/utils/server-auth";
import { formsService } from "~/services/forms.service";
import { formResultsService } from "~/services/form-results.service";

const ONBOARDING_FORM_KEY = "affilation";

export const onPost = async (event: any) => {
  const user = await requireAuth(event);
  const body = await event.request.json().catch(() => null);

  if (!body || typeof body !== "object") {
    return new Response(JSON.stringify({ error: "Invalid request payload." }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const formId = typeof body.formId === "string" ? body.formId : undefined;
  const result = body.result ?? null;
  const altchaPayload = body.altcha ?? null;

  // Try to resolve the form either from the submitted formId or by using the known system key.
  const form =
    (formId && (await formsService.getById(formId))) ||
    (await formsService.getBySystemKey(ONBOARDING_FORM_KEY));

  if (!form) {
    return new Response(
      JSON.stringify({ error: "Onboarding form is not configured." }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }

  await formResultsService.create({
    formId: form.id,
    userId: user.id,
    resultJson: result,
    altchaPayload,
  });

  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};
