/**
 * Core → theme data contract for a scope's home page (`/<scope path>`, e.g. `/germany/berlin`,
 * served by the catch-all route), and for the core-owned `useScopesList` block composable.
 * The UI calls scopes groups, regions and chapters.
 */

import type { useJoinScope } from "~/core/scopes/scope-actions";
export type JoinScopeAction = ReturnType<typeof useJoinScope>;

/** A scope in a listing (child scopes of a scope home page, the "Groups List" block). */
export interface ScopeListItem {
	id: string;
	name: string;
	kind: string;
	/** Public home page URL, e.g. "/germany/berlin". */
	url: string;
	/** Public thumbnail URL of the first home page image. */
	imageUrl: string | null;
	/** Members of the scope and of every scope below it. */
	memberCount: number;
}

/** One upcoming event on a scope home page. */
export interface ScopeUpcomingEvent {
	id: string;
	title: string;
	startDate: string;
	endDate: string;
	image1: string | null;
	locationType: string;
	city: string | null;
	address: string | null;
	/** Name of the owning scope when it is not the page's scope (content flowing in). */
	source: string | null;
}

/**
 * Sections that active modules add to a scope home page. One optional field per contributed
 * section, named after what the theme renders; the page merges the `scopePage` hook results of
 * all active modules into its loader output. Contribute only what the viewer may see.
 */
export interface ScopeExtras {
	/** Number of finished events of the scope. */
	pastEventCount?: number;
	/** The scope's next events (max 3), soonest first. */
	upcomingEvents?: ScopeUpcomingEvent[];
}

/** A scope member as other visitors see them. */
export interface ScopeMemberCard {
	id: string;
	name: string;
	familyName: string;
	/** Public thumbnail URL (never the private full-size picture). */
	profilePictureSmall: string | null;
	profileUrl: string;
}

/** Payload of a scope home page (declared, not derived: it shows members and authors). */
export type ScopeViewData = ScopeExtras & {
	scope: { id: string; name: string; kind: string; description: string | null };
	/** Ancestors below the root, root first, for the breadcrumb. */
	parents: Array<{ name: string; url: string }>;
	/** Child scopes (e.g. the chapters of a region). */
	childScopes: ScopeListItem[];
	/** Members of the scope and of every scope below it. */
	memberCount: number;
	pastEventCount: number;
	upcomingEvents: ScopeUpcomingEvent[];
	recentMembers: ScopeMemberCard[];
	/** The scope's (first) representative. */
	rep: {
		name: string;
		subtitle: string;
		profilePictureUrl: string | null;
		profileUrl: string;
	} | null;
	/** Explicit member of this scope or of one below it. */
	isMember: boolean;
	isLoggedIn: boolean;
	recentPosts: Array<{
		id: string;
		title: string;
		body: string;
		createdAt: string;
		featuredImage: string | null;
		authorName: string;
		/** Name of the owning scope when it is not the page's scope (content flowing in). */
		source: string | null;
	}>;
	image1: string | null;
	image2: string | null;
	image3: string | null;
};
