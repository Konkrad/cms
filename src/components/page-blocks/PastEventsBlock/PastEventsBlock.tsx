import { component$, useSignal, useTask$, $ } from "@qwik.dev/core";
import { server$ } from "@qwik.dev/router";
import type { BlockDefinition } from "~/db/schema";
import type { Event } from "~/db/schemas/events";
import { eventsService } from "~/services/events.service";
import { ListCard } from "../ListCard/ListCard";

export const definition: BlockDefinition = {
  name: "Past Events",
  componentType: "PastEventsBlock",
  category: "dynamic",
  icon: "🕰️",
  configSchema: [],
  defaultData: {},
};

const fetchYears = server$(async () => {
  return eventsService.getYears();
});

const fetchEventsByYear = server$(async (year: number) => {
  return eventsService.getEventsByYear(year);
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
  const years = useSignal<number[]>([]);
  const selectedYear = useSignal<number | null>(null);
  const events = useSignal<Event[]>([]);
  const isLoadingYears = useSignal(true);
  const isLoadingEvents = useSignal(false);
  const error = useSignal<string | null>(null);

  useTask$(async () => {
    try {
      years.value = await fetchYears();
      if (years.value.length) {
        selectedYear.value = years.value[0];
        events.value = await fetchEventsByYear(years.value[0]);
      }
    } catch (e) {
      error.value = e instanceof Error ? e.message : "Failed to load years";
    } finally {
      isLoadingYears.value = false;
    }
  });

  const handleYearChange = $(async (year: number) => {
    selectedYear.value = year;
    isLoadingEvents.value = true;
    try {
      events.value = await fetchEventsByYear(year);
    } catch (e) {
      error.value = e instanceof Error ? e.message : "Failed to load events";
    } finally {
      isLoadingEvents.value = false;
    }
  });

  return (
    <div class="max-w-6xl mx-auto px-4 py-12">
      {isLoadingYears.value ? (
        <div class="text-center py-12">
          <p class="text-gray-500">Loading years...</p>
        </div>
      ) : error.value ? (
        <p class="text-red-500 text-center py-8">
          Failed to load: {error.value}
        </p>
      ) : years.value.length === 0 ? (
        <p class="text-gray-500 text-center py-8">No past events found.</p>
      ) : (
        <div>
          <div class="mb-8">
            <select
              class="border border-gray-300 rounded-lg px-4 py-2 text-sm font-medium text-gray-900 bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              value={selectedYear.value ?? ""}
              onChange$={(e) => {
                const year = parseInt(
                  (e.target as HTMLSelectElement).value,
                  10,
                );
                if (!isNaN(year)) {
                  handleYearChange(year);
                }
              }}
            >
              {years.value.map((year) => (
                <option key={year} value={year}>
                  {String(year)}
                </option>
              ))}
            </select>
          </div>

          {isLoadingEvents.value ? (
            <div class="text-center py-8">
              <p class="text-gray-500">Loading events...</p>
            </div>
          ) : events.value.length === 0 ? (
            <p class="text-gray-500 text-center py-8">
              No events for {selectedYear.value}.
            </p>
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
      )}
    </div>
  );
});
