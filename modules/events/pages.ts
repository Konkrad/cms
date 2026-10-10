import { definePage } from "~/core";
import { loadCheckoutPage, loadPhotosPage } from "./public-checkout";
import { loadEventPage } from "./public-event";

export const eventDetailPage = definePage({
	id: "events.detail",
	path: "/events/:id",
	// Open to visitors: anonymous visitors see the event, logged-in ones also their RSVP.
	// Group-only events are limited to the group's members (see `canViewEvent`).
	load: (event, { params }) => loadEventPage(event, params.id),
	// The event venue's coordinates (the page draws the map); not a person's location.
	allowPrivateFields: ["latitude", "longitude"],
});

export const eventCheckoutPage = definePage({
	id: "events.checkout",
	path: "/events/:id/checkout",
	load: (event, { params }) => loadCheckoutPage(event, params.id),
	allowPrivateFields: [
		// The logged-in buyer's OWN email and consent answers, prefilled into checkout.
		"email",
		"foodPreference",
		"photoConsentGiven",
		// Stripe's publishable key is public by design (Stripe.js needs it in the browser).
		"stripePublishableKey",
	],
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
