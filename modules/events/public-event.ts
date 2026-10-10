import type { RequestEventLoader } from "@qwik.dev/router";
import { eq, inArray } from "drizzle-orm";
import {
	buildProfileUrl,
	currentScopeRest,
	db,
	deriveThumbnailKey,
	getCurrentUserData,
	groupMemberships,
	groupMembershipsService,
	groupRepresentatives,
	groupRepresentativesService,
	groups as groupsTable,
	matchPath,
	publicImageUrlFromKey,
	toPublicUser,
} from "~/core";
import { eventsService } from "./services/events";
import { participationService } from "./services/participation";

/** Server-only: import from page loaders and actions only, never from components. */

/** The `:id` of the event page the action was posted from (the catch-all route has no `id` param). */
export const eventIdOf = (
	event: Parameters<typeof currentScopeRest>[0],
	pattern: string,
) => matchPath(pattern, currentScopeRest(event))?.id;

type Viewer = { id: string; role?: string | null } | null;

/**
 * Group-only events are for members (and representatives) of the event's group;
 * platform admins see everything. Global events are public.
 */
export async function canViewEvent(
	event: { visibility: string; groupId: string | null },
	viewer: Viewer,
): Promise<boolean> {
	if (event.visibility !== "group-only") return true;
	if (!viewer) return false;
	if (viewer.role === "admin") return true;
	if (!event.groupId) return false;
	const [isMember, isRep] = await Promise.all([
		groupMembershipsService.isMember(viewer.id, event.groupId),
		groupRepresentativesService.isRepresentative(viewer.id, event.groupId),
	]);
	return isMember || isRep;
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
) {
	// The page shows the visitor's RSVP and login state: never serve it from a shared cache.
	requestEvent.cacheControl({ noCache: true });

	const viewable = await getViewableEvent(requestEvent, eventId);
	if (!viewable) {
		requestEvent.status(404);
		return null;
	}
	const { event, viewer: userData } = viewable;

	const groups = (await db.query.inventoryGroups.findMany({
		where: { eventId },
		with: {
			products: true,
		},
	})) as unknown as Array<{
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

		const userTicket = await db.query.tickets.findFirst({
			where: { eventId, buyerId: userData.id },
		});
		hasUserTicket = !!userTicket;

		const scannedTicket = await db.query.tickets.findFirst({
			where: {
				eventId,
				buyerId: userData.id,
				scannedAt: { isNotNull: true },
			},
		});
		hasAttended = !!scannedTicket;
	}

	const participationSummary = await participationService.getSummary(eventId);

	const participationRows = (await db.query.participationStatus.findMany({
		where: { eventId },
		with: { user: true },
	})) as unknown as Array<{
		status: "yes" | "no" | "maybe";
		userId: string;
		user: {
			id: string;
			name: string;
			familyName: string;
			profilePicture: string | null;
			profilePictureSmall: string | null;
			city: string | null;
			country: string | null;
		};
	}>;

	const goingRows = participationRows.filter(
		(r) => r.status === "yes" || r.status === "maybe",
	);
	const participantUserIds = goingRows.map((r) => r.userId);

	// userId -> group role label (e.g. "Local Rep Berlin")
	const userGroupLabels: Record<string, string> = {};

	if (participantUserIds.length > 0) {
		const repRows = await db
			.select({
				userId: groupRepresentatives.userId,
				groupId: groupRepresentatives.groupId,
				groupName: groupsTable.name,
			})
			.from(groupRepresentatives)
			.innerJoin(groupsTable, eq(groupRepresentatives.groupId, groupsTable.id))
			.where(inArray(groupRepresentatives.userId, participantUserIds));

		for (const rep of repRows) {
			userGroupLabels[rep.userId] = `Local Rep ${rep.groupName}`;
		}

		// For users that aren't representatives, fall back to their group membership
		const missingUsers = participantUserIds.filter(
			(id) => !userGroupLabels[id],
		);
		if (missingUsers.length > 0) {
			const memberRows = await db
				.select({
					userId: groupMemberships.userId,
					groupName: groupsTable.name,
				})
				.from(groupMemberships)
				.innerJoin(groupsTable, eq(groupMemberships.groupId, groupsTable.id))
				.where(inArray(groupMemberships.userId, missingUsers));

			for (const mem of memberRows) {
				if (!userGroupLabels[mem.userId]) {
					userGroupLabels[mem.userId] = mem.groupName;
				}
			}
		}
	}

	const participantsUnsorted = goingRows.map((r) => {
		const u = r.user;
		return {
			id: u.id,
			name: u.name as string,
			familyName: u.familyName as string,
			profilePictureSmall: publicImageUrlFromKey(
				u.profilePicture
					? (u.profilePictureSmall ?? deriveThumbnailKey(u.profilePicture))
					: null,
			),
			groupLabel: userGroupLabels[u.id] ?? null,
			city: (u.city ?? null) as string | null,
			country: (u.country ?? null) as string | null,
			profileUrl: buildProfileUrl({
				id: u.id,
				name: u.name as string,
				familyName: u.familyName as string,
			}),
		};
	});

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

export type EventPageData = Awaited<ReturnType<typeof loadEventPage>>;
