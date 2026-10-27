import type { ProfileEventEntry } from "~/contracts/profile";
import type { ScopeEventsData } from "~/contracts/scopes";
import {
	localFirst,
	publicImageUrlFromKey,
	scopeContentFilter,
	scopeSourceLabels,
	withItemUrls,
} from "~/core";
import { eventsService } from "./services/events";
import { participationService } from "./services/participation";

/** Server-only data of the events module's slots (`slots.tsx`, through `useEventsSlots.ts`). */
export interface ProfileEventsData {
	upcoming: ProfileEventEntry[];
	past: ProfileEventEntry[];
}

/** Events a user said "yes" to (public: shown on every profile, as before the slots). */
export async function profileEventsOf(
	userId: string,
): Promise<ProfileEventsData> {
	const { upcoming, past } = await participationService.getByUserId(userId);
	const entry = (e: (typeof upcoming)[number] & { url: string }) => ({
		id: e.id,
		url: e.url,
		title: e.title,
		startDate: e.startDate,
		endDate: e.endDate,
		city: e.city,
		country: e.country,
	});
	return {
		upcoming: (await withItemUrls("events:event", upcoming)).map(entry),
		past: (await withItemUrls("events:event", past)).map(entry),
	};
}

/**
 * The events section of a scope home page for `viewer`: the scope's listing (own and ancestors'
 * events as far as the viewer may see them, public events from below, labelled with their
 * source), its next 3 events and its finished-event count.
 */
export async function scopeEventsFor(
	scopeId: string,
	viewer: { id: string } | null,
): Promise<ScopeEventsData> {
	const filter = await scopeContentFilter(viewer, scopeId);
	const [pastEventCount, candidates] = await Promise.all([
		eventsService.countPastByScopeId(scopeId),
		eventsService.getUpcoming(filter, 30),
	]);
	// The scope's own (and its subtree's) events first, then the ancestors', soonest first.
	const upcoming = localFirst(candidates, filter, 3).sort((a, b) =>
		a.startDate.localeCompare(b.startDate),
	);
	const sources = await scopeSourceLabels(
		scopeId,
		upcoming.map((e) => e.scopeId),
	);
	return {
		pastEventCount,
		upcomingEvents: (await withItemUrls("events:event", upcoming)).map((e) => ({
			id: e.id,
			url: e.url,
			title: e.title,
			startDate: e.startDate,
			endDate: e.endDate,
			image1: publicImageUrlFromKey(e.image1),
			locationType: e.locationType,
			city: e.city,
			address: e.address,
			source: sources[e.scopeId] ?? null,
		})),
	};
}
