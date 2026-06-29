/**
 * Core → theme data contracts for the public elections routes.
 */
import type { useElections } from "~/routes/elections";
import type { useMyApplications } from "~/routes/elections/mine";
import type { useElectionDetail } from "~/routes/elections/[id]";
import type { useApplyData, useSubmitApplication } from "~/routes/elections/[id]/apply";

export type ElectionsViewData = ReturnType<typeof useElections>["value"];
export type MyApplicationsViewData = ReturnType<typeof useMyApplications>["value"];
export type ElectionDetailViewData = ReturnType<typeof useElectionDetail>["value"];
export type ApplyViewData = ReturnType<typeof useApplyData>["value"];
export type SubmitApplicationAction = ReturnType<typeof useSubmitApplication>;
