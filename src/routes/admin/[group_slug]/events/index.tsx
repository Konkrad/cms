import { component$ } from "@builder.io/qwik";
import { Form, Link, routeAction$, routeLoader$ } from "@builder.io/qwik-city";
import { format } from "date-fns";
import { Button } from "~/components/ui/Button";
import { eventsService } from "~/services/events.service";
import { groupsService } from "~/services/groups.service";

export const useEvents = routeLoader$(async ({ params }) => {
  const groupSlug = params.group_slug;
  const { participationService } = await import("~/services/participation.service");
  
  // Get all events or group-specific events
  const { items } = await eventsService.getAll();
  
  // Filter by group if not global
  let filteredItems = items;
  if (groupSlug !== "global") {
    const group = await groupsService.getBySlug(groupSlug);
    if (group) {
      filteredItems = items.filter((e) => e.groupId === group.id);
    }
  }
  
  // Fetch participation counts for all events
  const eventsWithParticipation = await Promise.all(
    filteredItems.map(async (event) => {
      const participationSummary = await participationService.getSummary(event.id);
      return {
        id: event.id,
        title: event.title,
        body: event.body,
        startDate: event.startDate,
        endDate: event.endDate,
        locationType: event.locationType,
        address: event.address,
        city: event.city,
        country: event.country,
        visibility: event.visibility,
        groupId: event.groupId,
        organizerName: event.user.displayName,
        participationCounts: participationSummary,
      };
    })
  );
  
  return { events: eventsWithParticipation, groupSlug };
});

export const useDeleteEvent = routeAction$(async (data, { sharedMap }) => {
  const eventId = data.eventId as string;
  const user = sharedMap.get("session");
  
  if (!user) {
    return { success: false, error: "Unauthorized" };
  }
  
  await eventsService.softDelete(eventId, user.id);
  return { success: true };
});

export default component$(() => {
  const data = useEvents();
  const deleteEventAction = useDeleteEvent();

  return (
    <div>
      <div class="flex items-center justify-between mb-6">
        <h2 class="text-2xl font-bold text-gray-800">
          {data.value.groupSlug === "global" ? "All Events" : "Group Events"}
        </h2>
        <Button href={`/admin/${data.value.groupSlug}/events/new`}>Create New Event</Button>
      </div>

      {data.value.events.length === 0 ? (
        <div class="bg-white rounded-lg shadow p-8 text-center">
          <p class="text-gray-600 mb-4">No events found.</p>
          <Button href={`/admin/${data.value.groupSlug}/events/new`}>Create Your First Event</Button>
        </div>
      ) : (
        <div class="bg-white shadow rounded-lg overflow-hidden">
          <table class="min-w-full divide-y divide-gray-200">
            <thead class="bg-gray-50">
              <tr>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Event
                </th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Date
                </th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Visibility
                </th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Participants
                </th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody class="bg-white divide-y divide-gray-200">
              {data.value.events.map((event) => (
                <tr key={event.id}>
                  <td class="px-6 py-4">
                    <div class="text-sm font-medium text-gray-900">{event.title}</div>
                    <div class="text-sm text-gray-500">{event.organizerName}</div>
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {format(new Date(event.startDate), "MMM d, yyyy")}
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap">
                    <span
                      class={`px-2 py-1 text-xs font-semibold rounded-full ${
                        event.visibility === "group-only"
                          ? "bg-blue-100 text-blue-800"
                          : "bg-green-100 text-green-800"
                      }`}
                    >
                      {event.visibility === "group-only" ? "Group Only" : "Global"}
                    </span>
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {event.participationCounts.going || 0} going
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-3">
                    <Link
                      href={`/admin/${data.value.groupSlug}/events/${event.id}/details`}
                      class="text-blue-600 hover:text-blue-900"
                    >
                      View
                    </Link>
                    <Link
                      href={`/admin/${data.value.groupSlug}/events/${event.id}/edit`}
                      class="text-indigo-600 hover:text-indigo-900"
                    >
                      Edit
                    </Link>
                    <Form action={deleteEventAction} class="inline">
                      <input type="hidden" name="eventId" value={event.id} />
                      <button
                        type="submit"
                        class="text-red-600 hover:text-red-900"
                        onClick$={(e) => {
                          if (!confirm("Are you sure you want to delete this event?")) {
                            e.preventDefault();
                          }
                        }}
                      >
                        Delete
                      </button>
                    </Form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
});
