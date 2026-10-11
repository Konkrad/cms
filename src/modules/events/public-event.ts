import type { RequestEventLoader } from "@qwik.dev/router";
import type { EventPageData } from "~/contracts/events";
import {
	buildProfileUrl,
	canViewScope,
	currentScopeRest,
	getCurrentUserData,
	getRootScope,
	matchPath,
	publicImageUrlFromKey,
	scopeLabels,
	toPublicUser,
} from "~/core";
import { eventsService } from "./services/events";
import { inventoryGroupsService } from "./services/inventory-groups";
import { participationService } from "./services/participation";
import { ticketsService } from "./services/tickets";

/** Server-only: import from page loaders and actions only, never from components. */

/** The `:id` of the event page the action was posted from (the catch-all route has no `id` param). */
export const eventIdOf = (
	event: Parameters<typeof currentScopeRest>[0],
	pattern: string,
) => matchPath(pattern, currentScopeRest(event))?.id;

type Viewer = { id: string } | null;

/**
 * Group-only events are for members of the event's scope (or of a scope below it) and role
 * holders on it (roles inherit downward, so root admins see everything). Global events are
 * public. Events without a scope belong to the root.
 */
export async function canViewEvent(
	event: { visibility: string; scopeId: string | null },
	viewer: Viewer,
): Promise<boolean> {
	if (event.visibility !== "group-only") return true;
	const scopeId = event.scopeId ?? (await getRootScope())?.id;
	if (!scopeId) return false;
	return canViewScope(viewer, scopeId, "members");
}

/** The event for a public page, or null (404) when missing, deleted or not visible to the viewer. */
export async function getViewableEvent(
	requestEvent: RequestEventLoader,
	eventId: string,
) {
	const event = await eventsService.getById(eventId);
	if (!event) return null;
	const viewer = (await getCurrentUserData(requestEvent)) as Viewer;
	return (await canViewEvent(event, viewer)) ? { event, viewer } : null;
}

const shuffle = <T>(arr: T[]): T[] => {
	const a = [...arr];
	for (let i = a.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[a[i], a[j]] = [a[j], a[i]];
	}
	return a;
};

/** Public event detail page data. Only fields the page renders are returned. */
export async function loadEventPage(
	requestEvent: RequestEventLoader,
	eventId: string,
): Promise<EventPageData> {
	// The page shows the visitor's RSVP and login state: never serve it from a shared cache.
	requestEvent.cacheControl({ noCache: true });

	const viewable = await getViewableEvent(requestEvent, eventId);
	if (!viewable) {
		requestEvent.status(404);
		return null;
	}
	const { event, viewer: userData } = viewable;

	const groups = (await inventoryGroupsService.getByEventId(
		eventId,
	)) as unknown as Array<{
		id: string;
		name: string;
		maxCapacity: number;
		salesStartDate: string | null;
		salesEndDate: string | null;
		products: Array<{
			id: string;
			name: string;
			price: number;
			maxQuantity: number;
			participantCapacity: number;
			features: string[];
			imageKey: string | null;
			soldQuantity: number;
		}>;
	}>;

	const salesValidation = await eventsService.validateSalesPeriod(event);

	const isLoggedIn = !!userData;
	let participationStatus = null;
	let hasAttended = false;
	let hasUserTicket = false;
	if (userData) {
		participationStatus = await participationService.getStatus(
			userData.id,
			eventId,
		);
		const ticketState = await ticketsService.getViewerTicketState(
			eventId,
			userData.id,
		);
		hasUserTicket = ticketState.hasTicket;
		hasAttended = ticketState.hasAttended;
	}

	const participationSummary = await participationService.getSummary(eventId);

	const going = await participationService.getGoingParticipants(eventId);
	// userId -> scope label (e.g. "Local Rep Berlin")
	const userGroupLabels = await scopeLabels(going.map((u) => u.id));

	const participantsUnsorted = going.map((u) => ({
		id: u.id,
		name: u.name,
		familyName: u.familyName,
		profilePictureSmall: u.profilePictureSmallUrl,
		groupLabel: userGroupLabels[u.id] ?? null,
		city: u.city,
		country: u.country,
		profileUrl: buildProfileUrl(u),
	}));

	// Prioritise users who have a profile picture, shuffle within each group
	const withPic = shuffle(
		participantsUnsorted.filter((p) => p.profilePictureSmall),
	);
	const withoutPic = shuffle(
		participantsUnsorted.filter((p) => !p.profilePictureSmall),
	);
	const participants = [...withPic, ...withoutPic];

	const now = new Date();
	const eventStart = new Date(event.startDate);
	const eventEnd = new Date(event.endDate);
	const isEventPast = now > eventEnd;
	const isEventFuture = now < eventStart;

	const allProducts = groups.flatMap((g) => g.products);
	const isFreeEvent =
		allProducts.length > 0 && allProducts.every((p) => p.price === 0);
	const hasSingleProduct = allProducts.length === 1;

	let activeSalesPeriod = false;
	let futureSalesPeriod = false;
	let pastSalesPeriod = false;
	let soldOut = false;

	for (const group of groups) {
		const salesStart = group.salesStartDate
			? new Date(group.salesStartDate)
			: null;
		const salesEnd = group.salesEndDate ? new Date(group.salesEndDate) : null;

		const withinWindow =
			(!salesStart || salesStart <= now) && (!salesEnd || salesEnd >= now);

		if (salesStart && salesStart > now) futureSalesPeriod = true;
		if (salesEnd && salesEnd < now) pastSalesPeriod = true;

		const soldQuantity =
			group.products?.reduce((sum, p) => sum + (p.soldQuantity || 0), 0) || 0;
		const remainingCapacity = group.maxCapacity - soldQuantity;

		if (withinWindow && remainingCapacity > 0) activeSalesPeriod = true;
		if (remainingCapacity <= 0) soldOut = true;
	}

	let mapImageUrl: string | null = null;
	if (event.latitude && event.longitude) {
		const lat = event.latitude;
		const lon = event.longitude;
		mapImageUrl = `https://staticmap.openstreetmap.de/staticmap.php?center=${lat},${lon}&zoom=10&size=600x600&maptype=mapnik&markers=${lat},${lon},red-pushpin`;
	}

	const locationDisplay =
		[event.city, event.country].filter(Boolean).join(", ") ||
		event.address ||
		(event.locationType === "online" ? "Online" : "");

	const organizer = toPublicUser(event.user);

	// Explicit allowlist: the event row and its organizer come from `getById` with the
	// organizer's full user row and email, which must never reach an anonymous visitor.
	return {
		id: event.id,
		title: event.title,
		body: event.body,
		startDate: event.startDate,
		endDate: event.endDate,
		locationType: event.locationType,
		address: event.address,
		city: event.city,
		country: event.country,
		latitude: event.latitude,
		longitude: event.longitude,
		onlineUrl: event.onlineUrl,
		// Guests only get the organizer's first name.
		user: {
			id: organizer.id,
			displayName: isLoggedIn
				? `${organizer.name} ${organizer.familyName}`
				: organizer.name,
		},
		salesStatus: salesValidation,
		userParticipation: participationStatus,
		products: allProducts,
		isFreeEvent,
		hasSingleProduct,
		activeSalesPeriod,
		futureSalesPeriod,
		pastSalesPeriod,
		soldOut,
		isEventPast,
		isEventFuture,
		hasAttended,
		hasUserTicket,
		isLoggedIn,
		participationSummary,
		mapImageUrl,
		locationDisplay,
		participants,
		image1: publicImageUrlFromKey(event.image1),
		image2: publicImageUrlFromKey(event.image2),
	};
}

export type { EventPageData };
