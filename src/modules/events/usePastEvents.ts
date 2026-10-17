import { $, useSignal, useTask$ } from "@qwik.dev/core";
import { server$ } from "@qwik.dev/router";
import type { EventsPage } from "~/contracts/events";
import {
	publicImageUrlFromKey,
	requestContentFilter,
	t,
	withItemUrls,
} from "~/core";
import { eventsService } from "./services/events";

// The listing of the page's scope (the URL's scope prefix), as the viewer sees it.
const fetchPastEvents = server$(async function (
	cursor?: string | null,
): Promise<EventsPage> {
	const { items, nextCursor } = await eventsService.getPastPaged(
		await requestContentFilter(this),
		10,
		cursor,
	);
	return {
		events: (await withItemUrls("events:event", items)).map((e) => ({
			...e,
			image1: publicImageUrlFromKey(e.image1),
		})),
		nextCursor,
	};
});

/** Headless composable owning data/pagination for the "Past Events" page-builder block. */
export function usePastEvents() {
	const events = useSignal<EventsPage["events"]>([]);
	const nextCursor = useSignal<string | null>(null);
	const isLoading = useSignal(true);
	const isLoadingMore = useSignal(false);
	const error = useSignal<string | null>(null);

	useTask$(async () => {
		try {
			const result = await fetchPastEvents(null);
			events.value = result.events;
			nextCursor.value = result.nextCursor;
		} catch (e) {
			error.value =
				e instanceof Error
					? e.message
					: t("events.usePastEvents.failedToLoadPastEvents");
		} finally {
			isLoading.value = false;
		}
	});

	const loadMore = $(async () => {
		if (!nextCursor.value || isLoadingMore.value) return;
		isLoadingMore.value = true;
		try {
			const result = await fetchPastEvents(nextCursor.value);
			events.value = [...events.value, ...result.events];
			nextCursor.value = result.nextCursor;
		} catch (e) {
			error.value =
				e instanceof Error
					? e.message
					: t("events.usePastEvents.failedToLoadMoreEvents");
		} finally {
			isLoadingMore.value = false;
		}
	});

	return { events, nextCursor, isLoading, isLoadingMore, error, loadMore };
}
