import { component$ } from "@qwik.dev/core";
import { type DocumentHead, routeLoader$ } from "@qwik.dev/router";
import type { SetupViewData } from "~/contracts/onboarding";
import { requireAuth } from "~/core/auth/server-auth";
import { t } from "~/core/i18n";
import { requirements } from "~/core/registry/requirements";
import { GLOBAL_CONTEXT } from "~/core/requirements/define";
import { safeNextPath } from "~/core/requirements/next-path";
import { assertNoPrivateFields } from "~/core/shared/no-private-fields";
import { SetupView } from "~theme/routes/onboarding/SetupView";
// Re-export core's single step action via a RELATIVE path (qwikRouter's production transform
// does not resolve the "~" alias for re-exported actions).
import { useSubmitRequirement } from "../../../core/requirements/useSubmitRequirement";

export { useSubmitRequirement };

/**
 * The setup flow (spec 4.6): the root layout sends a user here while a `global` requirement is
 * pending; each step is submitted through core's single action, and once none is left the user
 * goes on to `next`.
 */
export const useSetupLoader = routeLoader$(
	async (event): Promise<SetupViewData> => {
		const user = await requireAuth(event);
		const next = safeNextPath(event.url.searchParams.get("next"));
		const steps = await requirements.steps(user, GLOBAL_CONTEXT);
		if (steps.length === 0) throw event.redirect(302, next);
		return assertNoPrivateFields(
			{ steps, next },
			// The viewer's OWN birth year and gender, prefilled into the profile step.
			{ allow: ["yearOfBirth", "sex"] },
		);
	},
);

export default component$(() => {
	const data = useSetupLoader();
	const submit = useSubmitRequirement();
	return <SetupView data={data.value} submit={submit} />;
});

export const head: DocumentHead = { title: t("core.setup.title") };
