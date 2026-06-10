import type { RequestHandler } from "@qwik.dev/router";
import { requireAuth } from "~/utils/server-auth";
import { formsService } from "~/services/forms.service";
import { formResultsService } from "~/services/form-results.service";

const ONBOARDING_FORM_KEY = "affilation";

export const onPost: RequestHandler = async (event) => {
  const { json, error: qwikError } = event;
  const user = await requireAuth(event);
  const body = await event.request.json().catch(() => null);

  if (!body || typeof body !== "object") {
    throw qwikError(400, "Invalid request payload.");
  }

  const formId = typeof body.formId === "string" ? body.formId : undefined;
  const result = body.result ?? {};
  const altchaPayload = body.altcha ?? null;

  const form =
    (formId && (await formsService.getById(formId))) ||
    (await formsService.getBySystemKey(ONBOARDING_FORM_KEY));

  if (!form) {
    throw qwikError(500, "Onboarding form is not configured.");
  }

  try {
    await formResultsService.upsert({
      formId: form.id,
      userId: user.id,
      resultJson: result,
      altchaPayload,
    });
  } catch (err: any) {
    throw qwikError(500, err?.message ?? "Database error");
  }

  json(200, { success: true });
};
