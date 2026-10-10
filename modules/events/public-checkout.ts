import type { RequestEventLoader } from "@qwik.dev/router";
import {
	deriveThumbnailKey,
	getServerSession,
	getStripePublishableKey,
	publicImageUrlFromKey,
} from "~/core-api";
import { getViewableEvent } from "./public-event";
import { inventoryGroupsService } from "./services/inventory-groups";
import { photosService } from "./services/photos";

/** Server-only: import from page loaders only, never from components. */

/** Data of the ticket purchase page; 404s for missing, deleted or not visible events. */
export async function loadCheckoutPage(
	requestEvent: RequestEventLoader,
	eventId: string,
) {
	if (!(await getViewableEvent(requestEvent, eventId))) {
		throw requestEvent.error(404, "Event not found");
	}

	const groups = await inventoryGroupsService.getByEventId(eventId);

	const now = new Date();

	// Remaining capacity, sales window and available products per group
	const groupsWithCapacity = groups.map((group: any) => {
		const soldQuantity =
			group.products?.reduce(
				(sum: number, p: any) => sum + (p.soldQuantity || 0),
				0,
			) || 0;
		const remainingCapacity = group.maxCapacity - soldQuantity;

		const salesStart = group.salesStartDate
			? new Date(group.salesStartDate)
			: null;
		const salesEnd = group.salesEndDate ? new Date(group.salesEndDate) : null;
		const isSalesOpen =
			(!salesStart || salesStart <= now) && (!salesEnd || salesEnd >= now);

		// Currently available products:
		// - group sales window must be open
		// - group must have remaining capacity
		// - product must have remaining quantity (or unlimited if maxQuantity === 0)
		const availableProducts = (group.products || []).filter((p: any) => {
			const productRemaining =
				p.maxQuantity && p.maxQuantity > 0
					? p.maxQuantity - (p.soldQuantity || 0)
					: Infinity;
			return isSalesOpen && remainingCapacity > 0 && productRemaining > 0;
		});

		return {
			...group,
			remainingCapacity,
			soldQuantity,
			isSalesOpen,
			availableProducts,
		};
	});

	const session = await getServerSession(requestEvent);

	return {
		eventId,
		groups: groupsWithCapacity,
		stripePublishableKey: getStripePublishableKey(),
		foodPreference: (session as any)?.foodPreference ?? null,
		photoConsentGiven: (session as any)?.photoConsentGiven ?? null,
		buyer: {
			id: (session as any)?.id ?? "",
			name: [(session as any)?.name, (session as any)?.familyName]
				.filter(Boolean)
				.join(" ")
				.trim(),
			email: (session as any)?.email ?? "",
			avatarUrl: (session as any)?.profilePicture
				? publicImageUrlFromKey(
						(session as any).profilePictureSmall ??
							deriveThumbnailKey((session as any).profilePicture),
					)
				: null,
		},
	};
}

export type CheckoutPageData = Awaited<ReturnType<typeof loadCheckoutPage>>;

/** Data of the attendee-only photo gallery: the event title plus the visible photos (or a failure). */
export async function loadPhotosPage(
	requestEvent: RequestEventLoader,
	eventId: string,
) {
	const viewable = await getViewableEvent(requestEvent, eventId);
	if (!viewable) throw requestEvent.error(404, "Event not found");
	const { event } = viewable;

	const user = await getServerSession(requestEvent);
	const photos = await loadAttendeePhotos(requestEvent, eventId, user?.id);

	return { event: { id: event.id, title: event.title }, photos };
}

type PhotoEntry = { id: string; uploadedAt: string };

/** The photos, or a failure the page renders as "access restricted" (with that HTTP status). */
type AttendeePhotos =
	| (PhotoEntry[] & { failed?: false; message?: undefined })
	| { failed: true; message: string };

async function loadAttendeePhotos(
	requestEvent: RequestEventLoader,
	eventId: string,
	userId: string | undefined,
): Promise<AttendeePhotos> {
	if (!userId) {
		requestEvent.status(401);
		return { failed: true, message: "Please log in to view photos" };
	}

	const hasAttended = await photosService.checkUserAttendance(userId, eventId);
	if (!hasAttended) {
		requestEvent.status(403);
		return {
			failed: true,
			message:
				"Only attendees who were scanned can view photos. Please ensure your ticket was scanned at the event.",
		};
	}

	const photos = await photosService.getByEventId(eventId, {
		limit: 100,
		offset: 0,
	});

	return photos.map((photo) => ({
		id: photo.id,
		uploadedAt: photo.uploadedAt,
	}));
}

export type PhotosPageData = Awaited<ReturnType<typeof loadPhotosPage>>;
