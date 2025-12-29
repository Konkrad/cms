import { component$ } from "@builder.io/qwik";
import { Link, type DocumentHead, routeLoader$, routeAction$, z, zod$, Form } from "@builder.io/qwik-city";
import { format } from "date-fns";
import { eventsService } from "~/services/events.service";
import { participationService } from "~/services/participation.service";
import { ParticipationToggle } from "~/components/events/ParticipationToggle";

export const useEvent = routeLoader$(async ({ params, status, sharedMap }) => {
  const event = await eventsService.getById(params.id);

  if (!event) {
    status(404);
    return null;
  }

  // Check sales period status
  const salesValidation = await eventsService.validateSalesPeriod(event);

  // Get participation status if user is logged in
  const session = sharedMap.get("session");
  let participationStatus = null;
  if (session?.userId) {
    participationStatus = await participationService.getStatus(
      session.userId,
      params.id,
    );
  }

  return {
    ...event,
    salesStatus: salesValidation,
    userParticipation: participationStatus,
  };
});

export const useUpdateParticipation = routeAction$(
  async (data, event) => {
    const session = event.sharedMap.get("session");
    if (!session?.userId) {
      return event.fail(401, { message: "Please log in to RSVP" });
    }

    await participationService.upsert(
      session.userId,
      event.params.id,
      data.status,
    );

    return { success: true };
  },
  zod$({
    status: z.enum(["yes", "no", "maybe"]),
  }),
);

export default component$(() => {
  const event = useEvent();
  const updateParticipation = useUpdateParticipation();

  if (!event.value) {
    return (
      <div class="max-w-4xl mx-auto px-4 py-16 text-center">
        <h1 class="text-4xl font-bold text-gray-900 mb-4">Event Not Found</h1>
        <p class="text-gray-600 mb-8">
          The event you're looking for doesn't exist or has been removed.
        </p>
        <Link
          href="/events"
          class="text-blue-600 hover:text-blue-800 font-medium"
        >
          Back to Events
        </Link>
      </div>
    );
  }

  const startDate = new Date(event.value.startDate);
  const endDate = new Date(event.value.endDate);
  const isMultiDay =
    format(startDate, "yyyy-MM-dd") !== format(endDate, "yyyy-MM-dd");

  return (
    <div class="min-h-screen bg-gray-50">
      <div class="max-w-4xl mx-auto px-4 py-12">
        {/* Header */}
        <div class="mb-6">
          <Link
            href="/events"
            class="text-blue-600 hover:text-blue-800 font-medium inline-flex items-center gap-2 mb-4"
          >
            ← Back to Events
          </Link>
          <h1 class="text-4xl font-bold text-gray-900 mb-4">
            {event.value.title}
          </h1>
        </div>

        {/* Participation Toggle */}
        <div class="bg-white rounded-lg shadow-md p-6 mb-8">
          <h3 class="text-lg font-semibold mb-4">Will you attend?</h3>
          <Form action={updateParticipation}>
            <ParticipationToggle
              currentStatus={event.value.userParticipation?.status || null}
              onStatusChange={(status) => {
                updateParticipation.submit({ status });
              }}
            />
          </Form>
        </div>

        {/* Event Details Card */}
        <div class="bg-white rounded-lg shadow-md overflow-hidden mb-8">
          {/* Date & Time */}
          <div class="p-6 border-b border-gray-200">
            <div class="flex items-start gap-4">
              <div class="flex-shrink-0 w-16 h-16 bg-blue-600 text-white rounded-lg flex flex-col items-center justify-center">
                <div class="text-2xl font-bold">{format(startDate, "dd")}</div>
                <div class="text-xs uppercase">{format(startDate, "MMM")}</div>
              </div>
              <div class="flex-1">
                <h3 class="text-lg font-semibold text-gray-900 mb-2">
                  Date & Time
                </h3>
                <div class="text-gray-600">
                  {isMultiDay ? (
                    <div>
                      <div class="font-medium">
                        {format(startDate, "EEEE, MMMM d, yyyy")} at{" "}
                        {format(startDate, "h:mm a")}
                      </div>
                      <div class="text-sm">to</div>
                      <div class="font-medium">
                        {format(endDate, "EEEE, MMMM d, yyyy")} at{" "}
                        {format(endDate, "h:mm a")}
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div class="font-medium">
                        {format(startDate, "EEEE, MMMM d, yyyy")}
                      </div>
                      <div>
                        {format(startDate, "h:mm a")} -{" "}
                        {format(endDate, "h:mm a")}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Location */}
          {event.value.locationType && (
            <div class="p-6 border-b border-gray-200">
              <h3 class="text-lg font-semibold text-gray-900 mb-2">Location</h3>
              <div class="text-gray-600">
                {event.value.locationType === "in-person" ? (
                  <div>
                    <div class="font-medium mb-1">In-Person Event</div>
                    {event.value.address && <div>{event.value.address}</div>}
                    {event.value.city && event.value.country && (
                      <div>
                        {event.value.city}, {event.value.country}
                      </div>
                    )}
                  </div>
                ) : event.value.locationType === "online" ? (
                  <div>
                    <div class="font-medium mb-1">Online Event</div>
                    {event.value.onlineUrl && (
                      <a
                        href={event.value.onlineUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        class="text-blue-600 hover:underline"
                      >
                        {event.value.onlineUrl}
                      </a>
                    )}
                  </div>
                ) : (
                  <div class="font-medium">Hybrid Event</div>
                )}
              </div>
            </div>
          )}

          {/* Description */}
          {event.value.body && (
            <div class="p-6 border-b border-gray-200">
              <h3 class="text-lg font-semibold text-gray-900 mb-2">
                About this event
              </h3>
              <div class="text-gray-600 whitespace-pre-wrap">
                {event.value.body}
              </div>
            </div>
          )}

          {/* Organizer */}
          <div class="p-6 bg-gray-50">
            <h3 class="text-lg font-semibold text-gray-900 mb-2">
              Organized by
            </h3>
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 bg-blue-600 text-white rounded-full flex items-center justify-center font-semibold">
                {event.value.user.displayName.charAt(0).toUpperCase()}
              </div>
              <div>
                <div class="font-medium text-gray-900">
                  {event.value.user.displayName}
                </div>
                <div class="text-sm text-gray-600">
                  {event.value.user.email}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Sales Period Status */}
        {!event.value.salesStatus.valid && (
          <div class={`rounded-lg p-6 mb-8 ${
            event.value.salesStatus.reason?.includes('open on') 
              ? 'bg-yellow-50 border border-yellow-200' 
              : 'bg-red-50 border border-red-200'
          }`}>
            <h3 class={`text-lg font-semibold mb-2 ${
              event.value.salesStatus.reason?.includes('open on')
                ? 'text-yellow-900'
                : 'text-red-900'
            }`}>
              {event.value.salesStatus.reason?.includes('open on') 
                ? '🕒 Sales Not Yet Open' 
                : '🔒 Sales Closed'}
            </h3>
            <p class={
              event.value.salesStatus.reason?.includes('open on')
                ? 'text-yellow-800'
                : 'text-red-800'
            }>
              {event.value.salesStatus.reason}
            </p>
          </div>
        )}

        {/* Additional Info */}
        <div class="bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 class="text-lg font-semibold text-blue-900 mb-2">
            Interested in this event?
          </h3>
          <p class="text-blue-800 mb-4">
            Contact the organizer at{" "}
            <a
              href={`mailto:${event.value.user.email}`}
              class="underline hover:text-blue-600"
            >
              {event.value.user.email}
            </a>{" "}
            for more information or to RSVP.
          </p>
        </div>
      </div>
    </div>
  );
});

export const head: DocumentHead = ({ resolveValue }) => {
  const event = resolveValue(useEvent);

  if (!event) {
    return {
      title: "Event Not Found",
    };
  }

  return {
    title: `${event.title} - Event`,
    meta: [
      {
        name: "description",
        content: event.body || `Event: ${event.title}`,
      },
    ],
  };
};
