import type { RequestHandler } from "@qwik.dev/router";
import { getServerSession } from "~/core/auth/server-auth";
import { formAccessService } from "~/core/forms/form-access.service";
import { formsService } from "~/core/forms/forms.service";
import { isSurveyForm } from "~/core/forms/purposes";
import { t } from "~/core/i18n";

export const onGet: RequestHandler = async (event) => {
	const { params, json } = event;
	const form = await formsService.getById(params.id);
	// Workflow forms (a purpose) are filled in their workflow, not as a survey.
	if (!form || !isSurveyForm(form)) {
		json(404, { error: t("core.forms.notFound") });
		return;
	}

	const user = await getServerSession(event as any);

	try {
		formAccessService.ensureViewAccess(form, user);
	} catch {
		json(401, { error: t("core.forms.authRequired") });
		return;
	}

	json(200, {
		data: {
			id: form.id,
			title: form.title,
			description: form.description,
			schemaJson: form.schema,
			requireAltcha: formAccessService.requiresAltcha(form),
		},
	});
};
