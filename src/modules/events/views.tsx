import { component$ } from "@qwik.dev/core";
import type { DocumentHeadValue } from "@qwik.dev/router";
import type { CheckoutData } from "~/contracts/checkout";
import type { EventPhotosPageData } from "~/contracts/event-photos";
import type { EventViewData } from "~/contracts/events";
import type { PageViews } from "~/core";
import { canonicalUrl, htmlToDescription } from "~/core/seo";
import { useSubmitRequirement } from "~/core/setup-actions";
import { CheckoutView } from "~theme/routes/events/CheckoutView";
import { EventPhotosView } from "~theme/routes/events/EventPhotosView";
import { EventView } from "~theme/routes/events/EventView";
import {
	useCheckPaymentStatus,
	useCreateCheckoutSession,
	useGenerateSecureUrl,
	useUpdateParticipation,
} from "./actions";

const EventPage = component$<{ data: EventViewData }>(({ data }) => {
	const updateParticipation = useUpdateParticipation();
	const submitRequirement = useSubmitRequirement();
	return (
		<EventView
			event={data}
			updateParticipation={updateParticipation}
			submitRequirement={submitRequirement}
		/>
	);
});

const CheckoutPage = component$<{ data: CheckoutData }>(({ data }) => {
	const createCheckoutSession = useCreateCheckoutSession();
	const checkPaymentStatus = useCheckPaymentStatus();
	const submitRequirement = useSubmitRequirement();
	return (
		<CheckoutView
			data={data}
			createCheckoutSession={createCheckoutSession}
			checkPaymentStatus={checkPaymentStatus}
			submitRequirement={submitRequirement}
		/>
	);
});

const PhotosPage = component$<{ data: EventPhotosPageData }>(({ data }) => {
	const generateUrlAction = useGenerateSecureUrl();
	return (
		<EventPhotosView
			event={data.event}
			photos={data.photos}
			generateUrlAction={generateUrlAction}
		/>
	);
});

function eventHead(data: EventViewData, url: URL): DocumentHeadValue {
	if (!data) {
		return { title: "Event Not Found" };
	}
	const event = data;
	const canonical = canonicalUrl(url.pathname, url.origin);
	const description = htmlToDescription(event.body) || `Event: ${event.title}`;

	return {
		title: `${event.title} - Event`,
		meta: [
			{ name: "description", content: description },
			{ property: "og:type", content: "event" },
			{ property: "og:title", content: event.title },
			{ property: "og:description", content: description },
			{ property: "og:url", content: canonical },
			...(event.image1
				? [{ property: "og:image", content: event.image1 }]
				: []),
		],
		links: [{ rel: "canonical", href: canonical }],
		scripts: [
			{
				type: "application/ld+json",
				script: JSON.stringify({
					"@context": "https://schema.org",
					"@type": "Event",
					name: event.title,
					startDate: event.startDate,
					endDate: event.endDate,
					eventAttendanceMode:
						event.locationType === "online"
							? "https://schema.org/OnlineEventAttendanceMode"
							: "https://schema.org/OfflineEventAttendanceMode",
					location:
						event.locationType === "online"
							? {
									"@type": "VirtualLocation",
									url: event.onlineUrl ?? canonical,
								}
							: {
									"@type": "Place",
									name: event.locationDisplay || event.title,
									address: event.address ?? event.locationDisplay ?? undefined,
								},
					image: event.image1 ?? undefined,
					description,
				}),
			},
		],
	};
}

export const eventsViews: PageViews = {
	"events.detail": {
		view: EventPage,
		head: (data, url) => eventHead(data as EventViewData, url),
	},
	"events.checkout": { view: CheckoutPage },
	"events.photos": {
		view: PhotosPage,
		head: (data) => {
			const { event } = data as EventPhotosPageData;
			return {
				title: `Photos - ${event.title}`,
				meta: [
					{
						name: "description",
						content: `View photos from ${event.title} event`,
					},
				],
			};
		},
	},
};
