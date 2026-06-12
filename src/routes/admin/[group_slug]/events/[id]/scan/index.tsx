import { component$, $ } from "@qwik.dev/core";
import {
  routeAction$,
  routeLoader$,
  zod$,
  z,
  type DocumentHead,
  useLocation,
  Link,
} from "@qwik.dev/router";
import { TicketScanner } from "~/components/events/TicketScanner";
import { ticketsService } from "~/services/tickets.service";
import { eventsService } from "~/services/events.service";
import { requireGroupAdmin } from "~/utils/access-control";

export const useEvent = routeLoader$(async ({ params }) => {
  const event = await eventsService.getById(params.id);
  if (!event) {
    throw new Error("Event not found");
  }
  return event;
});

export const useScanTicket = routeAction$(
  async (data, event) => {
    const { isGlobal, group } = await requireGroupAdmin(event);
    const target = await eventsService.getById(event.params.id);
    if (!target) throw event.error(404, "Event not found");
    if (!isGlobal && target.groupId !== group.id) throw event.error(403, "Forbidden");
    const result = await ticketsService.scanTicket(data.qrData, event.params.id);

    if (!result.success) {
      return {
        success: false,
        message: result.error,
      };
    }

    return {
      success: true,
      message: "Ticket scanned successfully!",
      ticketId: result.ticket.id,
      scannedAt: result.ticket.scannedAt,
      participants: result.participants,
    };
  },
  zod$({
    qrData: z.string().min(1),
  }),
);

export default component$(() => {
  const event = useEvent();
  const scanAction = useScanTicket();
  const location = useLocation();
  const parts = location.url.pathname.split("/");
  const groupSlug = parts[2] || "global";
  const attendanceUrl = `/admin/${groupSlug}/events/${event.value.id}/attendance`;

  return (
    <div class="container mx-auto px-4 py-8 max-w-4xl">
      <div class="mb-6">
        <h1 class="text-3xl font-bold text-gray-900">{event.value.title}</h1>
        <p class="mt-2 text-gray-600">
          Scan tickets for attendance verification
        </p>
      </div>

      <TicketScanner
        eventId={event.value.id}
        onScan={$(async (qrData: string) => {
          const result = await scanAction.submit({ qrData });
          if (!result.value || result.value.failed) {
            return {
              success: false,
              message:
                result.value?.fieldErrors?.qrData || "Failed to process scan",
            };
          }
          return {
            success: result.value.success,
            message: result.value.message,
            ticketId: result.value.ticketId,
            scannedAt: result.value.scannedAt ?? undefined,
            participants: result.value.participants,
          };
        })}
      />

      <div class="mt-8">
        <Link
          href={attendanceUrl}
          class="inline-flex items-center text-blue-600 hover:text-blue-700 font-medium"
        >
          <svg
            class="w-5 h-5 mr-2"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
            />
          </svg>
          View Attendance Report
        </Link>
      </div>
    </div>
  );
});

export const head: DocumentHead = ({ resolveValue }) => {
  const event = resolveValue(useEvent);
  return {
    title: `Scan Tickets - ${event.title}`,
    meta: [
      {
        name: "description",
        content: `Scan tickets for ${event.title} event`,
      },
    ],
  };
};
