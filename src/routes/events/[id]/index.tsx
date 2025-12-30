import { component$, $ } from "@builder.io/qwik";
import {
  Link,
  type DocumentHead,
  routeLoader$,
  routeAction$,
  z,
  zod$,
  Form,
} from "@builder.io/qwik-city";
import { format } from "date-fns";
import { eventsService } from "~/services/events.service";
import { participationService } from "~/services/participation.service";
import { ParticipationToggle } from "~/components/events/ParticipationToggle";
import { db } from "~/db/connection";
import { inventoryGroups } from "~/db/schemas/inventory-groups";
import { tickets } from "~/db/schemas/tickets";
import { eq, and, isNotNull } from "drizzle-orm";

export const useEvent = routeLoader$(async ({ params, status, sharedMap }) => {
  const event = await eventsService.getById(params.id);

  if (!event) {
    status(404);
    return null;
  }

  // Get inventory groups with products
  const groups = await db.query.inventoryGroups.findMany({
    where: eq(inventoryGroups.eventId, params.id),
    with: {
      products: true,
    },
  });

  // Check sales period status
  const salesValidation = await eventsService.validateSalesPeriod(event);

  // Get participation status if user is logged in
  const session = sharedMap.get("session");
  let participationStatus = null;
  let hasAttended = false;
  if (session?.userId) {
    participationStatus = await participationService.getStatus(
      session.userId,
      params.id,
    );

    // Check if user has a scanned ticket for this event
    const scannedTicket = await db.query.tickets.findFirst({
      where: and(
        eq(tickets.eventId, params.id),
        eq(tickets.buyerId, session.userId),
        isNotNull(tickets.scannedAt),
      ),
    });
    hasAttended = !!scannedTicket;
  }

  // Calculate event ticket info
  const now = new Date();
  const eventStart = new Date(event.startDate);
  const eventEnd = new Date(event.endDate);
  const isEventPast = now > eventEnd;
  const isEventFuture = now < eventStart;

  // Determine if this is a free event with single product
  const allProducts = groups.flatMap((g) => g.products);
  const isFreeEvent =
    allProducts.length > 0 && allProducts.every((p) => p.price === 0);
  const hasSingleProduct = allProducts.length === 1;

  // Check if any sales period is currently active
  let activeSalesPeriod = false;
  let futureSalesPeriod = false;
  let pastSalesPeriod = false;
  let soldOut = false;

  for (const group of groups) {
    const salesStart = group.salesStartDate
      ? new Date(group.salesStartDate)
      : null;
    const salesEnd = group.salesEndDate ? new Date(group.salesEndDate) : null;

    const withinWindow =
      (!salesStart || salesStart <= now) && (!salesEnd || salesEnd >= now);

    if (salesStart && salesStart > now) {
      futureSalesPeriod = true;
    }

    if (salesEnd && salesEnd < now) {
      pastSalesPeriod = true;
    }

    const soldQuantity =
      group.products?.reduce((sum, p) => sum + (p.soldQuantity || 0), 0) || 0;
    const remainingCapacity = group.maxCapacity - soldQuantity;

    if (withinWindow && remainingCapacity > 0) {
      activeSalesPeriod = true;
    }

    if (remainingCapacity <= 0) {
      soldOut = true;
    }
  }

  return {
    ...event,
    salesStatus: salesValidation,
    userParticipation: participationStatus,
    products: allProducts,
    isFreeEvent,
    hasSingleProduct,
    activeSalesPeriod,
    futureSalesPeriod,
    pastSalesPeriod,
    soldOut,
    isEventPast,
    isEventFuture,
    hasAttended,
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

export const useRSVPWithTicket = routeAction$(
  async (data, event) => {
    const session = event.sharedMap.get("session");
    if (!session?.userId) {
      return event.fail(401, { message: "Please log in to RSVP" });
    }

    // Update participation status
    await participationService.upsert(
      session.userId,
      event.params.id,
      data.status,
    );

    // If status is "yes", create a free ticket
    if (data.status === "yes" && data.productId) {
      const { ticketsService } = await import("~/services/tickets.service");
      await ticketsService.createFreeTicket({
        productId: data.productId,
        eventId: event.params.id,
        buyerId: session.userId,
      });
    }

    return { success: true };
  },
  zod$({
    status: z.enum(["yes", "no", "maybe"]),
    productId: z.string().optional(),
  }),
);

export default component$(() => {
  const event = useEvent();
  const updateParticipation = useUpdateParticipation();
  const rsvpWithTicket = useRSVPWithTicket();

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

  // Determine what to show for tickets/RSVP
  const hasProducts = event.value.products.length > 0;

  const showFreeRSVP =
    !event.value.isEventPast &&
    hasProducts &&
    event.value.isFreeEvent &&
    event.value.hasSingleProduct &&
    event.value.activeSalesPeriod &&
    !event.value.soldOut;

  const showWaitlist =
    !event.value.isEventPast &&
    event.value.isEventFuture &&
    (!event.value.activeSalesPeriod || !hasProducts) &&
    !event.value.soldOut;

  const showBuyTickets =
    !event.value.isEventPast &&
    hasProducts &&
    event.value.activeSalesPeriod &&
    !event.value.soldOut &&
    (!event.value.isFreeEvent || !event.value.hasSingleProduct);

  const showSalesClosed =
    !event.value.isEventPast &&
    hasProducts &&
    event.value.pastSalesPeriod &&
    !event.value.activeSalesPeriod &&
    event.value.isEventFuture;

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

        {/* Free Event RSVP or Participation Toggle */}
        {!event.value.isEventPast && (
          <div class="bg-white rounded-lg shadow-md p-6 mb-8">
            {showFreeRSVP ? (
              <>
                <h3 class="text-lg font-semibold mb-4">
                  Will you attend? (Free Event)
                </h3>
                <Form action={rsvpWithTicket}>
                  <input
                    type="hidden"
                    name="productId"
                    value={event.value.products[0]?.id}
                  />
                  <div class="flex flex-wrap gap-3">
                    <button
                      type="submit"
                      name="status"
                      value="yes"
                      class="flex-1 min-w-[120px] px-6 py-3 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg transition-colors"
                    >
                      ✓ Yes
                    </button>
                    <button
                      type="submit"
                      name="status"
                      value="maybe"
                      class="flex-1 min-w-[120px] px-6 py-3 bg-yellow-500 hover:bg-yellow-600 text-white font-medium rounded-lg transition-colors"
                    >
                      ? Maybe
                    </button>
                    <button
                      type="submit"
                      name="status"
                      value="no"
                      class="flex-1 min-w-[120px] px-6 py-3 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg transition-colors"
                    >
                      ✗ No
                    </button>
                  </div>
                </Form>
                {event.value.userParticipation?.status === "yes" && (
                  <div class="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg text-green-800">
                    ✓ You're attending! Your free ticket has been created.
                  </div>
                )}
                {event.value.userParticipation?.status === "maybe" && (
                  <div class="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-yellow-800">
                    You're on the waitlist.
                  </div>
                )}
                {event.value.userParticipation?.status === "no" && (
                  <div class="mt-4 p-3 bg-gray-50 border border-gray-200 rounded-lg text-gray-800">
                    You've indicated you won't attend.
                  </div>
                )}
              </>
            ) : showWaitlist ? (
              <>
                <h3 class="text-lg font-semibold mb-4">
                  Ticket sales haven't started yet
                </h3>
                <p class="text-gray-600 mb-4">
                  Add yourself to the waitlist to be notified when tickets
                  become available.
                </p>
                <Form action={updateParticipation}>
                  <button
                    type="submit"
                    name="status"
                    value="maybe"
                    class="w-full px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
                  >
                    Add me to waitlist
                  </button>
                </Form>
                {event.value.userParticipation?.status === "maybe" && (
                  <div class="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg text-blue-800">
                    ✓ You're on the waitlist!
                  </div>
                )}
              </>
            ) : showBuyTickets ? (
              <>
                <h3 class="text-lg font-semibold mb-4">Get Your Tickets</h3>
                <Link
                  href={`/events/${event.value.id}/checkout`}
                  class="block w-full px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors text-center"
                >
                  Buy Tickets
                </Link>
              </>
            ) : (
              <>
                <h3 class="text-lg font-semibold mb-4">Will you attend?</h3>
                <Form action={updateParticipation}>
                  <ParticipationToggle
                    currentStatus={
                      event.value.userParticipation?.status || null
                    }
                    onStatusChange={$((status: "yes" | "no" | "maybe") => {
                      updateParticipation.submit({ status });
                    })}
                  />
                </Form>
              </>
            )}
          </div>
        )}

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

        {/* Sales Period Status Messages */}
        {showSalesClosed && (
          <div class="rounded-lg p-6 mb-8 bg-red-50 border border-red-200">
            <h3 class="text-lg font-semibold mb-2 text-red-900">
              🔒 Ticket Sale is Closed
            </h3>
            <p class="text-red-800">
              The sales period has ended for this event.
            </p>
          </div>
        )}

        {event.value.soldOut && (
          <div class="rounded-lg p-6 mb-8 bg-orange-50 border border-orange-200">
            <h3 class="text-lg font-semibold mb-2 text-orange-900">
              🎫 Sold Out
            </h3>
            <p class="text-orange-800">
              All tickets for this event have been sold.
            </p>
          </div>
        )}

        {/* Photo Gallery Access (for verified attendees of past events) */}
        {event.value.isEventPast && event.value.hasAttended && (
          <div class="bg-purple-50 border border-purple-200 rounded-lg p-6 mb-8">
            <div class="flex items-start gap-4">
              <svg
                class="w-8 h-8 text-purple-600 flex-shrink-0"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
              <div class="flex-1">
                <h3 class="text-lg font-semibold text-purple-900 mb-2">
                  📸 Event Photos
                </h3>
                <p class="text-purple-800 mb-4">
                  You attended this event! View the photo gallery with all the
                  memories from this event.
                </p>
                <Link
                  href={`/events/${event.value.id}/photos`}
                  class="inline-block bg-purple-600 hover:bg-purple-700 text-white font-medium px-4 py-2 rounded-lg transition-colors"
                >
                  View Photo Gallery
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* Additional Info */}
        {!event.value.isEventPast && (
          <div class="bg-blue-50 border border-blue-200 rounded-lg p-6">
            <h3 class="text-lg font-semibold text-blue-900 mb-2">
              Questions about this event?
            </h3>
            <p class="text-blue-800 mb-4">
              Contact the organizer at{" "}
              <a
                href={`mailto:${event.value.user.email}`}
                class="underline hover:text-blue-600"
              >
                {event.value.user.email}
              </a>{" "}
              for more information.
            </p>
          </div>
        )}
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
