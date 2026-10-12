import type { RequestHandler } from "@qwik.dev/router";
import { requireAuth } from "~/core/auth/server-auth";
import { FormAnswerError } from "~/core/forms/answers";
import { formResultsService } from "~/core/forms/form-results.service";
import {
	formAssignmentsService,
	formsService,
} from "~/core/forms/forms.service";
import { ONBOARDING_PURPOSE } from "~/core/forms/purposes";
import { getRootScope } from "~/core/scopes/access";
import { markConsentStepComplete } from "~/core/users/onboarding";

/** Saves the user's onboarding survey: the active `core.onboarding` form of the root. */
export const onPost: RequestHandler = async (event) => {
	const user = await requireAuth(event);
	const { json, error: qwikError } = event;
	const body = await event.request.json().catch(() => null);

	if (!body || typeof body !== "object") {
		throw qwikError(400, "Invalid request payload.");
	}

	const root = await getRootScope();
	const form = root
		? await formAssignmentsService.activeFor(ONBOARDING_PURPOSE, root.id)
		: undefined;
	if (!form) {
		throw qwikError(500, "Onboarding form is not configured.");
	}

	let answers: Record<string, unknown>;
	try {
		answers = formsService.validateAnswers(form, body.result ?? {});
	} catch (err) {
		if (err instanceof FormAnswerError) throw qwikError(400, err.message);
		throw err;
	}

	await formResultsService.saveOwn({
		formId: form.id,
		userId: user.id,
		answers,
		altchaPayload: typeof body.altcha === "string" ? body.altcha : null,
	});
	await markConsentStepComplete(user.id, "survey");

	json(200, { success: true });
};
