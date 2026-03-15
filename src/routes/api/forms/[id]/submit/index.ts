import type { RequestHandler } from "@builder.io/qwik-city";
import { altchaService } from "~/services/altcha.service";
import { formAccessService } from "~/services/form-access.service";
import { formResultsService } from "~/services/form-results.service";
import { formValidationService } from "~/services/form-validation.service";
import { formsService } from "~/services/forms.service";
import { getServerSession } from "~/utils/server-auth";

export const onPost: RequestHandler = async (event) => {
  const { params, request, json } = event;
  const form = await formsService.getById(params.id);
  if (!form) {
    json(404, { error: "Form not found" });
    return;
  }

  const user = await getServerSession(event as any);

  if (form.visibility === "private" && !user) {
    json(401, { error: "Authentication required" });
    return;
  }

  let payload: { result?: unknown; altcha?: string } = {};
  try {
    payload = await request.json();
  } catch {
    json(400, { error: "Invalid request payload" });
    return;
  }

  try {
    formAccessService.ensureViewAccess(form, user);
  } catch {
    json(401, { error: "Authentication required" });
    return;
  }

  const validatedResult = formValidationService.validateResultPayload(payload.result || {});

  if (formAccessService.requiresAltcha(form)) {
    const isValidAltcha = await altchaService.verifyPayload(payload.altcha || "");
    if (!isValidAltcha) {
      json(400, { error: "ALTCHA verification failed" });
      return;
    }
  }

  if (user) {
    const existing = await formResultsService.getByFormAndUser(form.id, user.id);
    if (existing) {
      json(409, { error: "You already submitted this form" });
      return;
    }
  }

  const created = await formResultsService.create({
    formId: form.id,
    userId: user?.id || null,
    resultJson: validatedResult,
    altchaPayload: payload.altcha || null,
  });

  json(200, {
    success: true,
    submissionId: created.id,
  });
};
