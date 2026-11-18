import { component$ } from "@qwik.dev/core";
import { t } from "~/contracts/i18n";
import type {
	SetupViewData,
	SubmitRequirementAction,
} from "~/contracts/onboarding";
import { RequirementSteps } from "~theme/shared/RequirementStep/RequirementStep";
import { SetupLayout } from "~theme/shared/SetupLayout/SetupLayout";

/** Themed view of the setup flow (`/profile/setup`): the user's pending global requirements. */
export const SetupView = component$<{
	data: SetupViewData;
	submit: SubmitRequirementAction;
}>(({ data, submit }) => {
	return (
		<SetupLayout
			title={t("theme.setup.completeYourProfile")}
			description={t("theme.setup.aFewStepsBeforeYou")}
		>
			<RequirementSteps steps={data.steps} action={submit} />
		</SetupLayout>
	);
});
