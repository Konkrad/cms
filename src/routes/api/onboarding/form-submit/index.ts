import type { RequestHandler } from "@qwik.dev/router";
import { requireAuth } from "~/core/auth/server-auth";
import { formResultsService } from "~/core/forms/form-results.service";
import { formsService } from "~/core/forms/forms.service";
import { markConsentStepComplete } from "~/core/users/onboarding";

const ONBOARDING_FORM_KEY = "affilation";

export const onPost: RequestHandler = async (event) => {
	const user = await requireAuth(event);
	const { json, error: qwikError } = event;
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
		await markConsentStepComplete(user.id, "survey");
	} catch (err: any) {
		throw qwikError(500, err?.message ?? "Database error");
	}

	json(200, { success: true });
};
