/**
 * Core → theme data contract for the public group page (`/groups/[slug]`),
 * and for the core-owned `useGroupsList` block composable.
 */

import type { Group } from "~/core/db/schema";
import type { useJoinGroup } from "~/routes/groups/[slug]";
export type JoinGroupAction = ReturnType<typeof useJoinGroup>;

/** Group list item as returned by `~/core/content/builder/blocks/useGroupsList`. */
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

/** A group member as other visitors see them. */
export interface GroupMemberCard {
	id: string;
	name: string;
	familyName: string;
	/** Public thumbnail URL (never the private full-size picture). */
	profilePictureSmall: string | null;
	profileUrl: string;
}

/** Payload of `/groups/[slug]` (declared, not derived: it shows members and authors). */
export type GroupViewData = GroupExtras & {
	group: Pick<Group, "id" | "name" | "slug">;
	memberCount: number;
	pastEventCount: number;
	upcomingEvents: GroupUpcomingEvent[];
	recentMembers: GroupMemberCard[];
	/** The group's (first) representative. */
	rep: {
		name: string;
		subtitle: string;
		profilePictureUrl: string | null;
		profileUrl: string;
	} | null;
	isMember: boolean;
	isLoggedIn: boolean;
	recentPosts: Array<{
		id: string;
		title: string;
		body: string;
		createdAt: string;
		featuredImage: string | null;
		authorName: string;
	}>;
	groupImage1: string | null;
	groupImage2: string | null;
	groupImage3: string | null;
};
