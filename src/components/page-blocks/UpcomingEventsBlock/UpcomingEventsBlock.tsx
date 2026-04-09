import { component$, useSignal, useTask$ } from "@builder.io/qwik";
import { server$ } from "@builder.io/qwik-city";
import type { BlockDefinition } from "~/db/schema";
import type { Event } from "~/db/schemas/events";
import { ListCard } from "../ListCard/ListCard";

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

function formatEventDate(startDate: string, endDate?: string): string {
  const start = new Date(startDate);
  const day = new Intl.DateTimeFormat("en-US", { day: "numeric" }).format(start);
  const month = new Intl.DateTimeFormat("en-US", { month: "long" }).format(start);
  const startTime = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(start);

  if (!endDate) {
    return `${day} ${month} · ${startTime}`;
  }

  const endTime = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(endDate));

  return `${day} ${month} · ${startTime} - ${endTime}`;
}

export default component$(() => {
  const events = useSignal<Event[]>([]);
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
              <ListCard
                key={event.id}
                title={event.title}
                image={event.image1}
                date={formatEventDate(event.startDate, event.endDate)}
                topRight={location}
                description={event.body?.replace(/<[^>]+>/g, "").substring(0, 180)}
                readMoreHref={`/events/${event.id}`}
                readMoreLabel="Open Tickets"
              />
            );
          })}
        </div>
      )}
    </div>
  );
});
