import { component$, useSignal, useTask$ } from "@builder.io/qwik";
import { Link, server$ } from "@builder.io/qwik-city";
import { format } from "date-fns";
import { Card } from "~/components/ui/Card";
import type { BlockDefinition } from "~/db/schema";
import type { EventWithUser } from "~/services/events.service";

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

  const toggleYear = async (year: number) => {
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
  };

  return (
    <div class="max-w-6xl mx-auto px-4 py-12">
      {isLoadingYears.value ? (
        <div class="text-center py-12">
          <p class="text-gray-500">Loading years...</p>
        </div>
      ) : error.value ? (
        <Card>
          <p class="text-red-500 text-center py-8">Failed to load: {error.value}</p>
        </Card>
      ) : years.value.length === 0 ? (
        <Card>
          <p class="text-gray-500 text-center py-8">No past events found.</p>
        </Card>
      ) : (
        <div>
          <div class="mb-6">
            <label class="block text-sm font-medium text-gray-700">Filter by year</label>
            <div class="flex gap-4 mt-3 flex-wrap">
              {years.value.map((year) => (
                <label key={year} class="inline-flex items-center space-x-2 text-sm">
                  <input
                    type="checkbox"
                    checked={selectedYears.value.includes(year)}
                    onChange$={async () => await toggleYear(year)}
                    class="h-4 w-4 text-blue-600 border-gray-300 rounded"
                  />
                  <span class="ml-1">{year}</span>
                </label>
              ))}
            </div>
          </div>

          {selectedYears.value.length === 0 ? (
            <Card>
              <p class="text-gray-500 text-center py-8">Select one or more years to view events.</p>
            </Card>
          ) : isLoadingEvents.value ? (
            <div class="text-center py-8">
              <p class="text-gray-500">Loading events...</p>
            </div>
          ) : (
            <div class="space-y-8">
              {selectedYears.value.map((year) => (
                <div key={year}>
                  <h3 class="text-xl font-semibold mb-4">{year}</h3>
                  {eventsByYear.value[year] && eventsByYear.value[year].length > 0 ? (
                    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {eventsByYear.value[year].map((event) => (
                        <Link key={event.id} href={`/events/${event.id}`}>
                          <Card hover>
                            <div class="flex justify-between items-start mb-3">
                              <h4 class="text-lg font-semibold text-gray-900 flex-1">
                                {event.title}
                              </h4>
                              <span
                                class={`px-2 py-1 text-xs font-medium rounded-full whitespace-nowrap ml-2 ${
                                  event.locationType === "online"
                                    ? "bg-blue-100 text-blue-800"
                                    : event.locationType === "in_person"
                                    ? "bg-green-100 text-green-800"
                                    : "bg-purple-100 text-purple-800"
                                }`}
                              >
                                {event.locationType?.replace("_", " ")}
                              </span>
                            </div>
                            <p class="text-gray-600 line-clamp-2 mb-3">{event.body}</p>
                            <div class="text-sm text-gray-500">
                              <p>{format(new Date(event.startDate), "PPP p")}</p>
                              {event.user && <p class="mt-1">{event.user.displayName}</p>}
                            </div>
                          </Card>
                        </Link>
                      ))}
                    </div>
                  ) : (
                    <Card>
                      <p class="text-gray-500 text-center py-8">No events for {year}.</p>
                    </Card>
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
