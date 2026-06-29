import { component$ } from "@qwik.dev/core";
import { routeLoader$, type DocumentHead } from "@qwik.dev/router";
import { eventsService } from "~/services/events.service";
import { participationService } from "~/services/participation.service";
import { ParticipationSummary } from "~/components/events/ParticipationSummary";

export const useEvent = routeLoader$(async ({ params }) => {
  const { requireAdmin } = await import("~/utils/server-auth");
  
  const event = await eventsService.getById(params.id);
  if (!event) {
    throw new Error("Event not found");
  }
  return event;
});

export const useParticipationData = routeLoader$(async ({ params }) => {
  const summary = await participationService.getSummary(params.id);
  const details = await participationService.getByEventId(params.id);
  
  return {
    summary,
    details,
  };
});

export default component$(() => {
  const event = useEvent();
  const participationData = useParticipationData();

  return (
    <div class="container mx-auto px-4 py-8 max-w-7xl">
      <div class="mb-6">
        <h1 class="text-3xl font-bold text-gray-900">
          Participation Summary: {event.value.title}
        </h1>
        <p class="mt-2 text-gray-600">
          Track who plans to attend your event
        </p>
      </div>

      {/* Summary Cards */}
      <div class="mb-8">
        <ParticipationSummary summary={participationData.value.summary} />
      </div>

      {/* Detailed List */}
      <div class="bg-white rounded-lg shadow-sm overflow-x-auto">
        <div class="px-6 py-4 border-b border-gray-200">
          <h2 class="text-xl font-bold text-gray-900">All Responses</h2>
        </div>

        {participationData.value.details.length === 0 ? (
          <div class="px-6 py-8 text-center text-gray-500">
            <p>No participation responses yet.</p>
          </div>
        ) : (
          <div class="overflow-x-auto">
            <table class="min-w-full divide-y divide-gray-200">
              <thead class="bg-gray-50">
                <tr>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    User
                  </th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Last Updated
                  </th>
                </tr>
              </thead>
              <tbody class="bg-white divide-y divide-gray-200">
                {participationData.value.details.map((participation: any) => (
                  <tr key={participation.id} class="hover:bg-gray-50">
                    <td class="px-6 py-4 whitespace-nowrap">
                      <div class="text-sm font-medium text-gray-900">
                        {participation.user.name}
                      </div>
                      <div class="text-sm text-gray-500">
                        {participation.user.email}
                      </div>
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap">
                      <span
                        class={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          participation.status === "yes"
                            ? "bg-green-100 text-green-800"
                            : participation.status === "maybe"
                              ? "bg-yellow-100 text-yellow-800"
                              : "bg-red-100 text-red-800"
                        }`}
                      >
                        {participation.status === "yes"
                          ? "Going"
                          : participation.status === "maybe"
                            ? "Maybe"
                            : "Not Going"}
                      </span>
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(participation.updatedAt).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
});

export const head: DocumentHead = ({ resolveValue }) => {
  const event = resolveValue(useEvent);
  return {
    title: `Participation Summary - ${event.title}`,
    meta: [
      {
        name: "description",
        content: `Participation summary for ${event.title} event`,
      },
    ],
  };
};
