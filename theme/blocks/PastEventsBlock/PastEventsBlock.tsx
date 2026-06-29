import { component$, useSignal, useTask$, $ } from "@qwik.dev/core";
import { server$ } from "@qwik.dev/router";
import type { BlockDefinition } from "~/db/schema";
import type { Event } from "~/db/schemas/events";
import { eventsService } from "~/services/events.service";
import { ListCard } from "../ListCard/ListCard";
import { publicImageUrlFromKey } from "~/utils/images";

export const definition: BlockDefinition = {
  name: "Past Events",
  componentType: "PastEventsBlock",
  category: "dynamic",
  icon: "🕰️",
  configSchema: [],
  defaultData: {},
};

const fetchPastEvents = server$(async (cursor?: string | null) => {
  const { items, nextCursor } = await eventsService.getPastPaged(10, cursor);
  return {
    events: items.map((e) => ({ ...e, image1: publicImageUrlFromKey(e.image1) })),
    nextCursor,
  };
});

function formatEventDate(startDate: string, endDate?: string): string {
  const start = new Date(startDate);
  const day = new Intl.DateTimeFormat("en-US", { day: "numeric" }).format(start);
  const month = new Intl.DateTimeFormat("en-US", { month: "long" }).format(start);
  const year = new Intl.DateTimeFormat("en-US", { year: "numeric" }).format(start);

  if (!endDate) return `${day} ${month} ${year}`;

  return `${day} ${month} ${year}`;
}

export default component$(() => {
  const events = useSignal<Event[]>([]);
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
      error.value = e instanceof Error ? e.message : "Failed to load past events";
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
      error.value = e instanceof Error ? e.message : "Failed to load more events";
    } finally {
      isLoadingMore.value = false;
    }
  });

  return (
    <div class="max-w-6xl mx-auto px-4 py-12">
      {isLoading.value ? (
        <div class="text-center py-12">
          <p class="text-text-muted">Loading past events...</p>
        </div>
      ) : error.value ? (
        <p class="text-error text-center py-8">Failed to load past events: {error.value}</p>
      ) : events.value.length === 0 ? (
        <p class="text-text-muted text-center py-8">No past events found.</p>
      ) : (
        <div class="flex flex-col gap-6">
          {events.value.map((event) => {
            const location =
              event.city || event.address || (event.locationType === "online" ? "Online" : "TBA");
            return (
              <ListCard
                key={event.id}
                title={event.title}
                image={event.image1}
                date={formatEventDate(event.startDate, event.endDate)}
                topRight={location}
                description={event.body?.replace(/<[^>]+>/g, "").substring(0, 180)}
                readMoreHref={`/events/${event.id}`}
                readMoreLabel="View Details"
              />
            );
          })}

          {nextCursor.value && (
            <div class="flex justify-center pt-2">
              <button
                class="px-6 py-2 rounded-lg border border-border text-sm font-medium text-text-secondary bg-bg-card hover:bg-bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
                onClick$={loadMore}
                disabled={isLoadingMore.value}
              >
                {isLoadingMore.value ? "Loading..." : "Load More"}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
});
