/**
 * Core → theme data contracts for the public elections pages (modules/elections).
 */
import type { useSubmitApplication } from "~modules/elections/actions";
import type {
	electionApplyPage,
	electionDetailPage,
	electionsListPage,
	myApplicationsPage,
} from "~modules/elections/pages";

type PageData<P extends { load: (...args: never[]) => Promise<unknown> }> =
	Awaited<ReturnType<P["load"]>>;

export type ElectionsViewData = PageData<typeof electionsListPage>;
export type MyApplicationsViewData = PageData<typeof myApplicationsPage>;
export type ElectionDetailViewData = PageData<typeof electionDetailPage>;
export type ApplyViewData = PageData<typeof electionApplyPage>;
export type SubmitApplicationAction = ReturnType<typeof useSubmitApplication>;
