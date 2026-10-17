/**
 * Core → theme data contracts for the public event detail route (`/events/:id`, src/modules/events),
 * and for the events-block composables (`~/modules/events/useUpcomingEvents`, `usePastEvents`).
 */

import type { RequirementStepData } from "~/contracts/requirements";
import type { StreamItemData } from "~/contracts/stream";
import type { useUpdateParticipation } from "~/modules/events/actions";
import type { Event } from "~/modules/events/schema/events";
import type { ParticipationStatus } from "~/modules/events/schema/participation-status";
import type { Product } from "~/modules/events/schema/products";
import type { eventsService } from "~/modules/events/services/events";

/** Someone going to an event, as other visitors see them. */
export type EventParticipant = {
	id: string;
	name: string;
	familyName: string;
	/** Public thumbnail URL (never the private full-size picture). */
	profilePictureSmall: string | null;
	groupLabel: string | null;
	city: string | null;
	country: string | null;
	profileUrl: string;
};

/** Payload of `/events/:id` (declared, not derived: it shows the organizer and attendees). */
export type EventPageData =
	| (Pick<
			Event,
			| "id"
			| "title"
			| "body"
			| "startDate"
			| "endDate"
			| "locationType"
			| "address"
			| "city"
			| "country"
			| "latitude"
			| "longitude"
			| "onlineUrl"
	  > & {
			/** Canonical URL under the owning scope, and its checkout and photos pages. */
			url: string;
			checkoutUrl: string;
			photosUrl: string;
			/** The organizer: first name only for guests, full name for members. */
			user: { id: string; displayName: string };
			salesStatus: Awaited<
				ReturnType<typeof eventsService.validateSalesPeriod>
			>;
			/** The viewer's own RSVP. */
			userParticipation: ParticipationStatus | null | undefined;
			products: Array<
				Pick<
					Product,
					| "id"
					| "name"
					| "price"
					| "maxQuantity"
					| "participantCapacity"
					| "features"
					| "imageKey"
					| "soldQuantity"
				>
			>;
			isFreeEvent: boolean;
			hasSingleProduct: boolean;
			activeSalesPeriod: boolean;
			futureSalesPeriod: boolean;
			pastSalesPeriod: boolean;
			soldOut: boolean;
			isEventPast: boolean;
			isEventFuture: boolean;
			hasAttended: boolean;
			hasUserTicket: boolean;
			isLoggedIn: boolean;
			participationSummary: {
				yes: number;
				no: number;
				maybe: number;
				total: number;
			};
			mapImageUrl: string | null;
			locationDisplay: string;
			participants: EventParticipant[];
			image1: string | null;
			image2: string | null;
			/** Notes and articles about the event (announcement, updates, recap) the viewer may see, newest first. */
			updates: StreamItemData[];
			/** Steps the viewer must complete before registering (their OWN data only). */
			requirements: RequirementStepData[];
	  })
	| null;

export type EventViewData = EventPageData;
export type UpdateParticipationAction = ReturnType<
	typeof useUpdateParticipation
>;
export type { SubmitRequirementAction } from "~/contracts/requirements";

/** Event shape returned by the events-block composables — `image1` resolved to a public URL. */
export type BlockEvent = Omit<Event, "image1"> & {
	image1: string | null;
	/** Canonical URL under the owning scope. */
	url: string;
};

export type EventsPage = { events: BlockEvent[]; nextCursor: string | null };
