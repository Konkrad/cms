import { $, useSignal, useTask$ } from "@qwik.dev/core";
import { server$ } from "@qwik.dev/router";
import type { EventsPage } from "~/contracts/events";
import { eventsService } from "~/services/events.service";
import { publicImageUrlFromKey } from "~/utils/images";

const fetchUpcomingInitial = server$(async (): Promise<EventsPage> => {
	const { items, nextCursor } = await eventsService.getUpcomingInitial(3);
	return {
		events: items.map((e) => ({
			...e,
			image1: publicImageUrlFromKey(e.image1),
		})),
		nextCursor,
	};
});

const fetchUpcomingMore = server$(
	async (cursor: string): Promise<EventsPage> => {
		const { items, nextCursor } = await eventsService.getUpcomingFrom(
			cursor,
			10,
		);
		return {
			events: items.map((e) => ({
				...e,
				image1: publicImageUrlFromKey(e.image1),
			})),
			nextCursor,
		};
	},
);

/** Headless composable owning data/pagination for the "Upcoming Events" page-builder block. */
export function useUpcomingEvents() {
	const events = useSignal<EventsPage["events"]>([]);
	const nextCursor = useSignal<string | null>(null);
	const isLoading = useSignal(true);
	const isLoadingMore = useSignal(false);
	const error = useSignal<string | null>(null);

	useTask$(async () => {
		try {
			const result = await fetchUpcomingInitial();
			events.value = result.events;
			nextCursor.value = result.nextCursor;
		} catch (e) {
			error.value = e instanceof Error ? e.message : "Failed to load events";
		} finally {
			isLoading.value = false;
		}
	});

	const loadMore = $(async () => {
		if (!nextCursor.value || isLoadingMore.value) return;
		isLoadingMore.value = true;
		try {
			const result = await fetchUpcomingMore(nextCursor.value);
			events.value = [...events.value, ...result.events];
			nextCursor.value = result.nextCursor;
		} catch (e) {
			error.value =
				e instanceof Error ? e.message : "Failed to load more events";
		} finally {
			isLoadingMore.value = false;
		}
	});

	return { events, nextCursor, isLoading, isLoadingMore, error, loadMore };
}
