import { component$ } from "@builder.io/qwik";
import {
  routeLoader$,
  type DocumentHead,
} from "@builder.io/qwik-city";
import { Card } from "~/components/ui/Card";
import { Button } from "~/components/ui/Button";
import { ticketsService } from "~/services/tickets.service";
import { eventsService } from "~/services/events.service";

export const useEvent = routeLoader$(async ({ params }) => {
  const event = await eventsService.getById(params.id);
  if (!event) {
    throw new Error("Event not found");
  }
  return event;
});

export const useAttendanceStats = routeLoader$(async ({ params }) => {
  return ticketsService.getAttendanceStats(params.id);
});

export const useAttendedTickets = routeLoader$(async ({ params }) => {
  return ticketsService.getAttendedTickets(params.id);
});

export default component$(() => {
  const event = useEvent();
  const stats = useAttendanceStats();
  const attendedTickets = useAttendedTickets();

  return (
    <div class="container mx-auto px-4 py-8 max-w-7xl">
      <div class="mb-6">
        <h1 class="text-3xl font-bold text-gray-900">
          Attendance Report: {event.value.title}
        </h1>
        <p class="mt-2 text-gray-600">
          Track ticket scans and attendance verification
        </p>
      </div>

      {/* Stats Cards */}
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <Card>
          <div class="text-center">
            <p class="text-sm font-medium text-gray-600">Total Tickets</p>
            <p class="mt-2 text-4xl font-bold text-gray-900">
              {stats.value.totalTickets}
            </p>
          </div>
        </Card>

        <Card>
          <div class="text-center">
            <p class="text-sm font-medium text-gray-600">Scanned</p>
            <p class="mt-2 text-4xl font-bold text-green-600">
              {stats.value.scannedTickets}
            </p>
          </div>
        </Card>

        <Card>
          <div class="text-center">
            <p class="text-sm font-medium text-gray-600">Attendance Rate</p>
            <p class="mt-2 text-4xl font-bold text-blue-600">
              {stats.value.attendanceRate.toFixed(1)}%
            </p>
          </div>
        </Card>

        <Card>
          <div class="text-center">
            <p class="text-sm font-medium text-gray-600">Free / Paid</p>
            <p class="mt-2 text-2xl font-bold text-gray-900">
              {stats.value.freeTickets} / {stats.value.paidTickets}
            </p>
          </div>
        </Card>
      </div>

      {/* Actions */}
      <div class="mb-6 flex flex-wrap gap-4">
        <a href={`/admin/events/${event.value.id}/scan`}>
          <Button>
            <svg
              class="w-5 h-5 mr-2 inline-block"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z"
              />
            </svg>
            Scan Tickets
          </Button>
        </a>
        <Button variant="secondary">
          <svg
            class="w-5 h-5 mr-2 inline-block"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
            />
          </svg>
          Export CSV
        </Button>
      </div>

      {/* Attended Tickets Table */}
      <Card>
        <h2 class="text-xl font-bold text-gray-900 mb-4">Attended Tickets</h2>

        {attendedTickets.value.length === 0 ? (
          <div class="text-center py-8 text-gray-500">
            <p>No tickets have been scanned yet.</p>
          </div>
        ) : (
          <div class="overflow-x-auto">
            <table class="min-w-full divide-y divide-gray-200">
              <thead class="bg-gray-50">
                <tr>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Ticket Holder
                  </th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Product
                  </th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Participants
                  </th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Type
                  </th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Scanned At
                  </th>
                </tr>
              </thead>
              <tbody class="bg-white divide-y divide-gray-200">
                {attendedTickets.value.map((ticket) => (
                  <tr key={ticket.id} class="hover:bg-gray-50">
                    <td class="px-6 py-4 whitespace-nowrap">
                      <div class="text-sm font-medium text-gray-900">
                        {ticket.buyer.name}
                      </div>
                      <div class="text-sm text-gray-500">
                        {ticket.buyer.loginId || "-"}
                      </div>
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {ticket.product.name}
                    </td>
                    <td class="px-6 py-4 text-sm text-gray-900">
                      {ticket.participants.length > 0 ? (
                        <ul class="space-y-1">
                          {ticket.participants.map((p) => (
                            <li key={p.id}>
                              {p.participantOrder}. {p.name}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <span class="text-gray-400">-</span>
                      )}
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap">
                      <span
                        class={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          ticket.isFree
                            ? "bg-green-100 text-green-800"
                            : "bg-blue-100 text-blue-800"
                        }`}
                      >
                        {ticket.isFree ? "Free" : "Paid"}
                      </span>
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {ticket.scannedAt
                        ? new Date(ticket.scannedAt).toLocaleString()
                        : "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
});

export const head: DocumentHead = ({ resolveValue }) => {
  const event = resolveValue(useEvent);
  return {
    title: `Attendance Report - ${event.title}`,
    meta: [
      {
        name: "description",
        content: `Attendance report for ${event.title} event`,
      },
    ],
  };
};
