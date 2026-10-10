import { definePage } from "~/core";
import { loadCheckoutPage, loadPhotosPage } from "./public-checkout";
import { loadEventPage } from "./public-event";

export const eventDetailPage = definePage({
	id: "events.detail",
	path: "/events/:id",
	// Open to visitors: anonymous visitors see the event, logged-in ones also their RSVP.
	// Group-only events are limited to the group's members (see `canViewEvent`).
	load: (event, { params }) => loadEventPage(event, params.id),
});

export const eventCheckoutPage = definePage({
	id: "events.checkout",
	path: "/events/:id/checkout",
	load: (event, { params }) => loadCheckoutPage(event, params.id),
});

export const eventPhotosPage = definePage({
	id: "events.photos",
	path: "/events/:id/photos",
	load: (event, { params }) => loadPhotosPage(event, params.id),
});

// More specific paths first; all are distinct segment counts, so order is only cosmetic.
export const eventsPages = [
	eventDetailPage,
	eventCheckoutPage,
	eventPhotosPage,
];
