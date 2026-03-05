import { component$, useSignal, useTask$, $ } from "@builder.io/qwik";
import { server$ } from "@builder.io/qwik-city";
import type { BlockDefinition } from "~/db/schema";
import type { EventWithUser } from "~/services/events.service";
import { EventCard } from "./EventCard";

export const definition: BlockDefinition = {
  name: "Past Events",
  componentType: "PastEventsBlock",
  category: "dynamic",
  icon: "🕰️",
  configSchema: [],
  defaultData: {},
};

const fetchYears = server$(async () => {
  const { eventsService } = (await import("~/services/events.service")) as any;
  return eventsService.getYears();
});

const fetchEventsByYear = server$(async (year: number) => {
  const { eventsService } = (await import("~/services/events.service")) as any;
  return eventsService.getEventsByYear(year);
});

export default component$(() => {
  const years = useSignal<number[]>([]);
  const selectedYears = useSignal<number[]>([]);
  const eventsByYear = useSignal<Record<number, EventWithUser[]>>({});
  const isLoadingYears = useSignal(true);
  const isLoadingEvents = useSignal(false);
  const error = useSignal<string | null>(null);

  useTask$(async () => {
    try {
      years.value = await fetchYears();
      if (years.value.length) {
        // default to most recent (first) year
        const initial = years.value[0];
        selectedYears.value = [initial];
        const ev = await fetchEventsByYear(initial);
        eventsByYear.value = { [initial]: ev };
      }
    } catch (e) {
      error.value = e instanceof Error ? e.message : "Failed to load years";
    } finally {
      isLoadingYears.value = false;
    }
  });

  const toggleYear = $(async (year: number) => {
    const sel = [...selectedYears.value];
    const idx = sel.indexOf(year);
    if (idx >= 0) {
      // remove
      sel.splice(idx, 1);
      selectedYears.value = sel;
      const copy = { ...eventsByYear.value };
      delete copy[year];
      eventsByYear.value = copy;
      return;
    }
    // add
    sel.push(year);
    // keep selection ordered descending for predictability
    sel.sort((a, b) => b - a);
    selectedYears.value = sel;

    if (!eventsByYear.value[year]) {
      try {
        isLoadingEvents.value = true;
        const ev = await fetchEventsByYear(year);
        eventsByYear.value = { ...eventsByYear.value, [year]: ev };
      } catch (e) {
        error.value = e instanceof Error ? e.message : "Failed to load events";
      } finally {
        isLoadingEvents.value = false;
      }
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
          <div class="mb-6">
            <label class="block text-sm font-medium text-gray-700">
              Filter by year
            </label>
            <div class="flex gap-4 mt-3 flex-wrap">
              {years.value.map((year) => (
                <label
                  key={year}
                  class="inline-flex items-center space-x-2 text-sm"
                >
                  <input
                    type="checkbox"
                    checked={selectedYears.value.includes(year)}
                    onChange$={() => toggleYear(year)}
                    class="h-4 w-4 text-blue-600 border-gray-300 rounded"
                  />
                  <span class="ml-1">{year}</span>
                </label>
              ))}
            </div>
          </div>

          {selectedYears.value.length === 0 ? (
            <p class="text-gray-500 text-center py-8">
              Select one or more years to view events.
            </p>
          ) : isLoadingEvents.value ? (
            <div class="text-center py-8">
              <p class="text-gray-500">Loading events...</p>
            </div>
          ) : (
            <div class="space-y-8">
              {selectedYears.value.map((year) => (
                <div key={year}>
                  <h3 class="text-xl font-semibold mb-4">{year}</h3>
                  {eventsByYear.value[year] &&
                  eventsByYear.value[year].length > 0 ? (
                    <div class="flex flex-col gap-6">
                      {eventsByYear.value[year].map((event) => {
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
                  ) : (
                    <p class="text-gray-500 text-center py-8">
                      No events for {year}.
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
});
