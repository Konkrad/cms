import { defineModule, t, withItemUrls } from "~/core";
import { eventsBlocks } from "./blocks";
import {
	debriefRequestedNotification,
	debriefSubmittedNotification,
	saleAlertNotification,
	ticketConfirmationNotification,
} from "./emails";
import { eventsPages } from "./pages";
import { eventsRequirements } from "./requirements";
import eventsSchema from "./schema";
import { eventsService } from "./services/events";
import { tagRulesService } from "./services/tag-rules";
import { eventsSettings } from "./settings";

export const eventsModule = defineModule({
	id: "events",
	schema: eventsSchema,
	pages: eventsPages,
	// Food preference and photo consent, asked before checkout/registration (spec 4.6).
	requirements: eventsRequirements,
	// Events are managed in every scope's admin, the root's included.
	admin: {
		sections: [
			{
				path: "events",
				label: t("events.module.events"),
				order: 30,
				scopes: "all",
			},
		],
	},
	blocks: eventsBlocks,
	menuLinks: [
		{ key: "events", label: t("events.module.events"), url: "/events" },
		{
			key: "tickets",
			label: t("events.module.myTickets"),
			url: "/profile/tickets",
			menu: "user",
		},
	],
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
	// Statistics: how engaged people are (engagement window and thresholds).
	settings: eventsSettings,
	// Profile events and settings (food preference, photo consent), the scope home page's
	// events, the admin dashboard's event count and the statistics page's events section;
	// components in slots.tsx.
	slots: [
		"profile.sections",
		"profile.settings",
		"userPage.sections",
		"scopePage.sections",
		"admin.dashboard.widgets",
		"admin.statistics.sections",
	],
	notifications: [
		ticketConfirmationNotification,
		saleAlertNotification,
		debriefRequestedNotification,
		debriefSubmittedNotification,
	],
	// Participation badges (tag rules) for events that have ended since (also run on each RSVP),
	// and the debrief requests to organisers of ended events (spec 5.2; lazy like the handlers).
	schedules: [
		{
			id: "tag-rules",
			every: "1d",
			run: async () => {
				await tagRulesService.evaluateRulesForAll();
			},
		},
		{
			id: "debrief-requests",
			every: "1d",
			run: async (ctx) => {
				await (await import("./debrief")).runDebriefRequests(ctx);
			},
		},
	],
	// `events:event:<id>` → `<scope path>/events/<slug>`.
	refs: {
		event: {
			label: t("events.module.event"),
			path: "/events/:slug",
			locate: (ids) => eventsService.locate(ids),
			find: (scopeId, param) => eventsService.findByParam(scopeId, param),
			search: (query, limit) => eventsService.searchPublic(query, limit),
		},
	},
	// Event images and product images (public), event photo galleries (private, admins).
	uploads: [
		{ prefix: "public/events/", minRole: "representative" },
		{ prefix: "private/events/", minRole: "admin" },
	],
	// Demo events (tickets, history, the Events page) and the e2e fixtures; lazy (dev deps).
	seed: async (ctx) => (await import("./seed")).seedEvents(ctx),
	// Proposal and debrief questions are forms admins edit (spec 5.2); the active form per scope.
	forms: [
		{ purpose: "events.proposal", label: t("events.module.eventProposal") },
		{ purpose: "events.debrief", label: t("events.module.eventDebrief") },
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
	// Ticket orders (spec 4.7): `payments.create({ module: "events" }, { kind: "tickets" })` in
	// the checkout. Lazy: the fulfilment graph (services, emails) would otherwise load with the
	// manifest and form an import cycle through ~/core.
	payments: {
		tickets: {
			onPaid: async (p, ctx) =>
				(await import("./payments")).onTicketsPaid(p, ctx),
			onFailed: async (p) => (await import("./payments")).onTicketsCanceled(p),
			onExpired: async (p) => (await import("./payments")).onTicketsCanceled(p),
			onRefunded: async (p) =>
				(await import("./payments")).onTicketsRefunded(p),
		},
	},
});
