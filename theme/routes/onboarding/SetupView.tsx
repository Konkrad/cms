import { component$ } from "@qwik.dev/core";
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
			title="Complete your profile"
			description="A few steps before you continue."
		>
			<RequirementSteps steps={data.steps} action={submit} />
		</SetupLayout>
	);
});
