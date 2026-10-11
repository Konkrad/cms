import {
	defineModule,
	groupMembershipsService,
	groupRepresentativesService,
	publicImageUrlFromKey,
} from "~/core";
import { eventsBlocks } from "./blocks";
import {
	saleAlertNotification,
	ticketConfirmationNotification,
} from "./emails";
import { eventsPages } from "./pages";
import { eventsService } from "./services/events";
import { participationService } from "./services/participation";
import { tagRulesService } from "./services/tag-rules";

export const eventsModule = defineModule({
	id: "events",
	pages: eventsPages,
	// Events are managed in every group's admin as well as the global one.
	admin: {
		sections: [{ path: "events", label: "Events", order: 30, scopes: "all" }],
	},
	blocks: eventsBlocks,
	// Detail pages of global events only; group-only events are not public.
	sitemap: async () => {
		const entries: { path: string; lastmod: string }[] = [];
		let cursor: string | null | undefined = null;
		do {
			const result = await eventsService.getAll(100, cursor);
			for (const evt of result.items) {
				if (evt.visibility !== "global") continue;
				entries.push({ path: `/events/${evt.id}`, lastmod: evt.updatedAt });
			}
			cursor = result.nextCursor;
		} while (cursor);
		return entries;
	},
	// Events a user said "yes" to. Shown on every profile, as before the module port.
	async profile({ userId }) {
		const { upcoming, past } = await participationService.getByUserId(userId);
		return { upcomingEvents: upcoming, pastEvents: past };
	},
	// The group's next events and its finished-event count. Group-only events are listed only
	// to the group's members and representatives.
	async groupPage({ groupId, viewerId }) {
		const [isMember, isRepresentative] = viewerId
			? await Promise.all([
					groupMembershipsService.isMember(viewerId, groupId),
					groupRepresentativesService.isRepresentative(viewerId, groupId),
				])
			: [false, false];
		const [pastEventCount, upcoming] = await Promise.all([
			eventsService.countPastByGroupId(groupId),
			eventsService.getUpcomingByGroupId(groupId, {
				includeGroupOnly: isMember || isRepresentative,
				limit: 3,
			}),
		]);
		return {
			pastEventCount,
			upcomingEvents: upcoming.map((e) => ({
				id: e.id,
				title: e.title,
				startDate: e.startDate,
				endDate: e.endDate,
				image1: publicImageUrlFromKey(e.image1),
				locationType: e.locationType,
				city: e.city,
				address: e.address,
			})),
		};
	},
	notifications: [ticketConfirmationNotification, saleAlertNotification],
	reevaluateUserTags: (userId) => tagRulesService.evaluateRulesForUser(userId),
	// Lazy: the fulfilment graph (Stripe client, services) would otherwise load with the
	// manifest and form an import cycle through ~/core (stripe.ts reads env at load time).
	payments: {
		tickets: {
			onPaid: async (ctx) => (await import("./payments")).onTicketsPaid(ctx),
		},
	},
});
