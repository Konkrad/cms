/**
 * Core → theme data contract for the setup flow (`/profile/setup`): the pending `global`
 * requirements of the logged-in user (spec 4.6), one step at a time.
 */
import type { RequirementStepData } from "~/contracts/requirements";

export type { SubmitRequirementAction } from "~/contracts/requirements";

export interface SetupViewData {
	/** Pending steps, in order; the first is shown. Prefilled with the viewer's OWN data. */
	steps: RequirementStepData[];
	/** Where the user goes once every step is done (an internal path). */
	next: string;
}
