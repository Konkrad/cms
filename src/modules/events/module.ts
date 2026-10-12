import {
	defineModule,
	localFirst,
	publicImageUrlFromKey,
	scopeContentFilter,
	scopeSourceLabels,
	withItemUrls,
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
	// Events are managed in every scope's admin, the root's included.
	admin: {
		sections: [{ path: "events", label: "Events", order: 30, scopes: "all" }],
	},
	blocks: eventsBlocks,
	// Detail pages of global events only; members-only events are not public.
	sitemap: async () => {
		const entries: { path: string; lastmod: string }[] = [];
		let cursor: string | null | undefined = null;
		do {
			const result = await eventsService.getAll(100, cursor);
			const visible = result.items.filter((e) => e.visibility === "public");
			for (const evt of await withItemUrls("events:event", visible)) {
				entries.push({ path: evt.url, lastmod: evt.updatedAt });
			}
			cursor = result.nextCursor;
		} while (cursor);
		return entries;
	},
	// Events a user said "yes" to. Shown on every profile, as before the module port.
	async profile({ userId }) {
		const { upcoming, past } = await participationService.getByUserId(userId);
		return {
			upcomingEvents: await withItemUrls("events:event", upcoming),
			pastEvents: await withItemUrls("events:event", past),
		};
	},
	// The scope's next events (its listing: own and ancestors' events as far as the viewer may
	// see them, public events from below, labelled with their source) and its finished-event count.
	async scopePage({ scopeId, viewerId }) {
		const filter = await scopeContentFilter(
			viewerId ? { id: viewerId } : null,
			scopeId,
		);
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
			upcomingEvents: (await withItemUrls("events:event", upcoming)).map(
				(e) => ({
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
				}),
			),
		};
	},
	scopeContentCount: (scopeId) => eventsService.countByScopeId(scopeId),
	notifications: [ticketConfirmationNotification, saleAlertNotification],
	// `events:event:<id>` → `<scope path>/events/<slug>`.
	refs: {
		event: {
			label: "Event",
			path: "/events/:slug",
			locate: (ids) => eventsService.locate(ids),
			find: (scopeId, param) => eventsService.findByParam(scopeId, param),
			search: (query, limit) => eventsService.searchPublic(query, limit),
		},
	},
	reevaluateUserTags: (userId) => tagRulesService.evaluateRulesForUser(userId),
	// Lazy: the fulfilment graph (Stripe client, services) would otherwise load with the
	// manifest and form an import cycle through ~/core (stripe.ts reads env at load time).
	// Proposal and debrief questions are forms admins edit (spec 5.2); the active form per scope.
	forms: [
		{ purpose: "events.proposal", label: "Event proposal" },
		{ purpose: "events.debrief", label: "Event debrief" },
	],
	// A chapter's public event is published when its proposal is approved (lazy: see payments).
	reviews: {
		event: {
			onApproved: async (ctx, decision) =>
				(await import("./review")).onEventApproved(ctx, decision),
			onRejected: async (ctx, decision) =>
				(await import("./review")).onEventRejected(ctx, decision),
		},
	},
	payments: {
		tickets: {
			onPaid: async (ctx) => (await import("./payments")).onTicketsPaid(ctx),
		},
	},
});
