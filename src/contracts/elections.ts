/**
 * Core → theme data contracts for the public elections pages (modules/elections).
 */

import type { PublicUser } from "~/core/users/public-user";
import type { useSubmitApplication } from "~modules/elections/actions";
import type {
	electionApplyPage,
	electionsListPage,
	myApplicationsPage,
} from "~modules/elections/pages";
import type { ElectionCycleWithPositions } from "~modules/elections/service";

type PageData<P extends { load: (...args: never[]) => Promise<unknown> }> =
	Awaited<ReturnType<P["load"]>>;

export type ElectionsViewData = PageData<typeof electionsListPage>;
export type MyApplicationsViewData = PageData<typeof myApplicationsPage>;
/** An approved candidate as other members see them: motivation and public identity only. */
export type ElectionCandidate = {
	id: string;
	positionId: string;
	motivationWhy: string;
	motivationExperience: string;
	motivationGoals: string;
	user: PublicUser;
};

/** Payload of `/elections/:id` (declared, not derived: it shows other members' applications). */
export type ElectionDetailViewData = {
	cycle: ElectionCycleWithPositions;
	approvedApps: ElectionCandidate[];
	userCanApply: boolean;
	userAppPositionIds: string[];
};
export type ApplyViewData = PageData<typeof electionApplyPage>;
export type SubmitApplicationAction = ReturnType<typeof useSubmitApplication>;
