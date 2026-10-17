import { component$ } from "@qwik.dev/core";
import { routeLoader$ } from "@qwik.dev/router";
import { getServerSession } from "~/core/auth/server-auth";
import { formAccessService } from "~/core/forms/form-access.service";
import { formResultsService } from "~/core/forms/form-results.service";
import { formsService } from "~/core/forms/forms.service";
import { isSurveyForm } from "~/core/forms/purposes";
import { FormPageView } from "~theme/routes/forms/FormPageView";

export const useFormPage = routeLoader$(async (event) => {
	const found = await formsService.getByRouteSlug(event.params.formSlug);
	// Workflow forms (a purpose) are filled in their workflow, not on a survey page.
	if (!found || !isSurveyForm(found)) {
		event.status(404);
		return null;
	}

	const user = await getServerSession(event);

	const form = {
		id: found.id,
		title: found.title,
		description: found.description,
		schema: found.schema,
		visibility: found.visibility,
		allowResubmission: found.allowResubmission,
	};
	try {
		formAccessService.ensureViewAccess(form, user);
	} catch {
		throw event.redirect(302, "/login");
	}

	let existingResult: Record<string, any> | null = null;
	let alreadySubmitted = false;
	if (user) {
		const existing = await formResultsService.getByFormAndUser(
			form.id,
			user.id,
		);
		if (existing) {
			alreadySubmitted = true;
			if (form.allowResubmission)
				existingResult = existing.answers as Record<string, any>;
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
