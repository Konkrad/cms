/**
 * Core → theme data contract for the public group page (`/groups/[slug]`),
 * and for the core-owned `useGroupsList` block composable.
 */

import type { Group } from "~/core/db/schema";
import type { useGroupData, useJoinGroup } from "~/routes/groups/[slug]";

export type GroupViewData = ReturnType<typeof useGroupData>["value"];
export type JoinGroupAction = ReturnType<typeof useJoinGroup>;

/** Group list item as returned by `~/components/builder/blocks/useGroupsList`. */
export type GroupListItem = Group & { memberCount: number };

/** One upcoming event on a group page. */
export interface GroupUpcomingEvent {
	id: string;
	title: string;
	startDate: string;
	endDate: string;
	image1: string | null;
	locationType: string;
	city: string | null;
	address: string | null;
}

/**
 * Sections that active modules add to the group page (`/groups/[slug]`). One optional field per
 * contributed section, named after what the theme renders; the page merges the `groupPage` hook
 * results of all active modules into its loader output. Contribute only what the viewer may see.
 */
export interface GroupExtras {
	/** Number of finished events of the group. */
	pastEventCount?: number;
	/** The group's next events (max 3), soonest first. */
	upcomingEvents?: GroupUpcomingEvent[];
}
