import { component$, useSignal, useTask$ } from "@builder.io/qwik";
import { server$ } from "@builder.io/qwik-city";
import type { BlockDefinition } from "~/db/schema";
import type { EventWithUser } from "~/services/events.service";
import { EventCard } from "./EventCard";

export const definition: BlockDefinition = {
  name: "Upcoming Events",
  componentType: "UpcomingEventsBlock",
  category: "dynamic",
  icon: "📅",
  configSchema: [],
  defaultData: {},
};

const fetchUpcoming = server$(async () => {
  const { eventsService } = (await import("~/services/events.service")) as any;
  return eventsService.getUpcoming();
});

export default component$(() => {
  const events = useSignal<EventWithUser[]>([]);
  const isLoading = useSignal(true);
  const error = useSignal<string | null>(null);

  useTask$(async () => {
    try {
      events.value = await fetchUpcoming();
    } catch (e) {
      error.value = e instanceof Error ? e.message : "Failed to load events";
    } finally {
      isLoading.value = false;
    }
  });

  return (
    <div class="max-w-6xl mx-auto px-4 py-12">
      {isLoading.value ? (
        <div class="text-center py-12">
          <p class="text-gray-500">Loading upcoming events...</p>
        </div>
      ) : error.value ? (
        <p class="text-red-500 text-center py-8">
          Failed to load events: {error.value}
        </p>
      ) : events.value.length === 0 ? (
        <p class="text-gray-500 text-center py-8">No upcoming events.</p>
      ) : (
        <div class="flex flex-col gap-6">
          {events.value.map((event) => {
            const location =
              event.city ||
              event.address ||
              (event.locationType === "online" ? "Online" : "TBA");

            return (
              <EventCard
                key={event.id}
                date={event.startDate}
                title={event.title}
                location={location}
                readMoreHref={`/events/${event.id}`}
              />
            );
          })}
        </div>
      )}
    </div>
  );
});
