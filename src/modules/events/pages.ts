import { definePage } from "~/core";
import { loadCheckoutPage, loadPhotosPage } from "./public-checkout";
import { loadEventPage } from "./public-event";

export const eventDetailPage = definePage({
	id: "events.detail",
	path: "/events/:slug",
	// Open to visitors: anonymous visitors see the event, logged-in ones also their RSVP.
	// Group-only events are limited to the group's members (see `canViewEvent`).
	load: (event, { params }) => loadEventPage(event, params.slug),
	// The event venue's coordinates (the page draws the map); not a person's location.
	allowPrivateFields: ["latitude", "longitude"],
});

export const eventCheckoutPage = definePage({
	id: "events.checkout",
	path: "/events/:slug/checkout",
	load: (event, { params }) => loadCheckoutPage(event, params.slug),
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
	path: "/events/:slug/photos",
	load: (event, { params }) => loadPhotosPage(event, params.slug),
});

// More specific paths first; all are distinct segment counts, so order is only cosmetic.
export const eventsPages = [
	eventDetailPage,
	eventCheckoutPage,
	eventPhotosPage,
];
