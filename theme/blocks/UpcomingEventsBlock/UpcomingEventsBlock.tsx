import { component$, useSignal, useTask$, $ } from "@qwik.dev/core";
import { server$ } from "@qwik.dev/router";
import type { BlockDefinition } from "~/db/schema";
import type { Event } from "~/db/schemas/events";
import { eventsService } from "~/services/events.service";
import { ContentCard } from "~theme/shared/ContentCard/ContentCard";
import { publicImageUrlFromKey } from "~/utils/images";

export const definition: BlockDefinition = {
  name: "Upcoming Events",
  componentType: "UpcomingEventsBlock",
  category: "dynamic",
  icon: "📅",
  configSchema: [],
  defaultData: {},
};

const fetchUpcomingInitial = server$(async () => {
  const { items, nextCursor } = await eventsService.getUpcomingInitial(3);
  return {
    events: items.map((e) => ({ ...e, image1: publicImageUrlFromKey(e.image1) })),
    nextCursor,
  };
});

const fetchUpcomingMore = server$(async (cursor: string) => {
  const { items, nextCursor } = await eventsService.getUpcomingFrom(cursor, 10);
  return {
    events: items.map((e) => ({ ...e, image1: publicImageUrlFromKey(e.image1) })),
    nextCursor,
  };
});

function formatEventDate(startDate: string, endDate?: string): string {
  const start = new Date(startDate);
  const day = new Intl.DateTimeFormat("en-US", { day: "numeric" }).format(start);
  const month = new Intl.DateTimeFormat("en-US", { month: "long" }).format(start);
  const startTime = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(start);

  if (!endDate) return `${day} ${month} · ${startTime}`;

  const endTime = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(endDate));

  return `${day} ${month} · ${startTime} - ${endTime}`;
}

export default component$(() => {
  const events = useSignal<Event[]>([]);
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
      error.value = e instanceof Error ? e.message : "Failed to load more events";
    } finally {
      isLoadingMore.value = false;
    }
  });

  return (
    <div class="max-w-6xl mx-auto px-4 py-12">
      {isLoading.value ? (
        <div class="text-center py-12">
          <p class="text-text-muted">Loading upcoming events...</p>
        </div>
      ) : error.value ? (
        <p class="text-error text-center py-8">Failed to load events: {error.value}</p>
      ) : events.value.length === 0 ? (
        <p class="text-text-muted text-center py-8">No upcoming events.</p>
      ) : (
        <>
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {events.value.map((event) => {
              const location =
                event.city || event.address || (event.locationType === "online" ? "Online" : "TBA");
              return (
                <ContentCard
                  key={event.id}
                  title={event.title}
                  image={event.image1}
                  date={formatEventDate(event.startDate, event.endDate)}
                  meta={location}
                  description={event.body?.replace(/<[^>]+>/g, "").substring(0, 180)}
                  href={`/events/${event.id}`}
                  label="Open Tickets"
                />
              );
            })}
          </div>

          {nextCursor.value && (
            <div class="flex justify-center pt-6">
              <button
                class="px-6 py-2 border border-border text-sm font-medium text-text-secondary bg-bg-card hover:bg-bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
                onClick$={loadMore}
                disabled={isLoadingMore.value}
              >
                {isLoadingMore.value ? "Loading..." : "Load More"}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
});
