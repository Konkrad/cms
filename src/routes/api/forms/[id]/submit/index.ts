import type { RequestHandler } from "@qwik.dev/router";
import { altchaService } from "~/core/auth/altcha.service";
import { getServerSession } from "~/core/auth/server-auth";
import { FormAnswerError } from "~/core/forms/answers";
import { formAccessService } from "~/core/forms/form-access.service";
import { formResultsService } from "~/core/forms/form-results.service";
import { formsService } from "~/core/forms/forms.service";
import { isSurveyForm } from "~/core/forms/purposes";

export const onPost: RequestHandler = async (event) => {
	const { params, request, json } = event;
	const form = await formsService.getById(params.id);
	// Workflow forms (a purpose) are filled in their workflow, not as a survey.
	if (!form || !isSurveyForm(form)) {
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

	let answers: Record<string, unknown>;
	try {
		// Validated against the form's questions on the server (spec 4.10).
		answers = formsService.validateAnswers(form, payload.result ?? {});
	} catch (error) {
		if (error instanceof FormAnswerError) {
			json(400, { error: error.message, fieldErrors: error.fieldErrors });
			return;
		}
		throw error;
	}

	if (formAccessService.requiresAltcha(form)) {
		const isValidAltcha = await altchaService.verifyPayload(
			payload.altcha || "",
		);
		if (!isValidAltcha) {
			json(400, { error: "ALTCHA verification failed" });
			return;
		}
	}

	if (user && !form.allowResubmission) {
		const existing = await formResultsService.getByFormAndUser(
			form.id,
			user.id,
		);
		if (existing) {
			json(409, { error: "You already submitted this form" });
			return;
		}
	}

	const result = {
		formId: form.id,
		answers,
		altchaPayload: payload.altcha || null,
	};
	const created =
		user && form.allowResubmission
			? await formResultsService.saveOwn({ ...result, userId: user.id })
			: await formResultsService.create({
					...result,
					userId: user?.id ?? null,
				});

	json(200, {
		success: true,
		submissionId: created.id,
	});
};
