import { component$, $, useSignal } from "@builder.io/qwik";
import {
  Link,
  type DocumentHead,
  routeLoader$,
  routeAction$,
  z,
  zod$,
  Form,
} from "@builder.io/qwik-city";

import { eventsService } from "~/services/events.service";
import { participationService } from "~/services/participation.service";
import { ParticipationToggle } from "~/components/events/ParticipationToggle";
import { db } from "~/db/connection";
import { inventoryGroups } from "~/db/schemas/inventory-groups";
import { tickets } from "~/db/schemas/tickets";
import { participationStatus as participationStatusTable } from "~/db/schemas/participation-status";
import { groupRepresentatives } from "~/db/schemas/group-representatives";
import { groups as groupsTable } from "~/db/schemas/groups";
import { groupMemberships } from "~/db/schemas/group-memberships";
import { eq, and, isNotNull, inArray } from "drizzle-orm";
import { getCurrentUserData } from "~/utils/server-auth";
import { env } from "~/env";

import { FeatureGrid } from "~/components/page-blocks/FeatureBlock/FeatureGrid";
import { EventDateTile } from "~/components/page-blocks/FeatureBlock/EventDateTile";
import { LocationTile } from "~/components/page-blocks/FeatureBlock/LocationTile";
import { ImageTile } from "~/components/page-blocks/FeatureBlock/ImageTile";
import { ParticipantsTile } from "~/components/page-blocks/FeatureBlock/ParticipantsTile";
import { ParticipantsModal } from "~/components/events/ParticipantsModal";

export const useEvent = routeLoader$(async (requestEvent) => {
  const { params, status } = requestEvent;
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
  const userData = await getCurrentUserData(requestEvent);
  const isLoggedIn = !!userData;
  let participationStatus = null;
  let hasAttended = false;
  if (userData) {
    participationStatus = await participationService.getStatus(
      userData.id,
      params.id,
    );

    const scannedTicket = await db.query.tickets.findFirst({
      where: and(
        eq(tickets.eventId, params.id),
        eq(tickets.buyerId, userData.id),
        isNotNull(tickets.scannedAt),
      ),
    });
    hasAttended = !!scannedTicket;
  }

  // Participation summary
  const participationSummary = await participationService.getSummary(params.id);

  // Fetch participants (yes / maybe) with profile pictures and group info
  const participationRows = await db.query.participationStatus.findMany({
    where: eq(participationStatusTable.eventId, params.id),
    with: { user: true },
  });

  const goingRows = participationRows.filter(
    (r) => r.status === "yes" || r.status === "maybe",
  );
  const participantUserIds = goingRows.map((r) => r.userId);

  // Build a map userId → group role label (e.g. "Local Rep Berlin")
  const userGroupLabels: Record<string, string> = {};

  if (participantUserIds.length > 0) {
    // Get representative status
    const repRows = await db
      .select({
        userId: groupRepresentatives.userId,
        groupId: groupRepresentatives.groupId,
        groupName: groupsTable.name,
      })
      .from(groupRepresentatives)
      .innerJoin(groupsTable, eq(groupRepresentatives.groupId, groupsTable.id))
      .where(inArray(groupRepresentatives.userId, participantUserIds));

    for (const rep of repRows) {
      userGroupLabels[rep.userId] = `Local Rep ${rep.groupName}`;
    }

    // For users that aren't representatives, fall back to their group membership
    const missingUsers = participantUserIds.filter(
      (id) => !userGroupLabels[id],
    );
    if (missingUsers.length > 0) {
      const memberRows = await db
        .select({
          userId: groupMemberships.userId,
          groupName: groupsTable.name,
        })
        .from(groupMemberships)
        .innerJoin(groupsTable, eq(groupMemberships.groupId, groupsTable.id))
        .where(inArray(groupMemberships.userId, missingUsers));

      for (const mem of memberRows) {
        if (!userGroupLabels[mem.userId]) {
          userGroupLabels[mem.userId] = mem.groupName;
        }
      }
    }
  }

  // Build profile picture URL helper
  const buildPicUrl = (s3Key: string | null) => {
    if (!s3Key) return null;
    const key = s3Key.replace(/^\//, "");
    return env.AWS_ENDPOINT
      ? `${env.AWS_ENDPOINT}/${env.S3_BUCKET}/${key}`
      : `https://${env.S3_BUCKET}.s3.${env.AWS_REGION}.amazonaws.com/${key}`;
  };

  const participants = goingRows.map((r) => {
    const u = r.user as any;
    return {
      id: u.id as string,
      displayName: (u.displayName ?? u.name ?? "User") as string,
      profilePictureSmallUrl: buildPicUrl(u.profilePictureSmall ?? null),
      groupLabel: userGroupLabels[u.id] ?? null,
      city: (u.city ?? null) as string | null,
      country: (u.country ?? null) as string | null,
    };
  });

  // Calculate event ticket info
  const now = new Date();
  const eventStart = new Date(event.startDate);
  const eventEnd = new Date(event.endDate);
  const isEventPast = now > eventEnd;
  const isEventFuture = now < eventStart;

  const allProducts = groups.flatMap((g) => g.products);
  const isFreeEvent =
    allProducts.length > 0 && allProducts.every((p) => p.price === 0);
  const hasSingleProduct = allProducts.length === 1;

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

  // Build a static map URL if we have coordinates
  let mapImageUrl: string | null = null;
  if (event.latitude && event.longitude) {
    const lat = event.latitude;
    const lon = event.longitude;
    mapImageUrl = `https://staticmap.openstreetmap.de/staticmap.php?center=${lat},${lon}&zoom=10&size=600x600&maptype=mapnik&markers=${lat},${lon},red-pushpin`;
  }

  // Location display string
  const locationDisplay =
    [event.city, event.country].filter(Boolean).join(", ") ||
    event.address ||
    (event.locationType === "online" ? "Online" : "");

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
    isLoggedIn,
    participationSummary,
    mapImageUrl,
    locationDisplay,
    participants,
  };
});

export const useUpdateParticipation = routeAction$(
  async (data, event) => {
    const userData = await getCurrentUserData(event);
    if (!userData) {
      return event.fail(401, { message: "Please log in to RSVP" });
    }

    await participationService.upsert(
      userData.id,
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
    const userData = await getCurrentUserData(event);
    if (!userData) {
      return event.fail(401, { message: "Please log in to RSVP" });
    }

    await participationService.upsert(
      userData.id,
      event.params.id,
      data.status,
    );

    if (data.status === "yes" && data.productId) {
      const { ticketsService } = await import("~/services/tickets.service");
      await ticketsService.createFreeTicket({
        productId: data.productId,
        eventId: event.params.id,
        buyerId: userData.id,
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

  const participantCount =
    event.value.participationSummary.yes +
    event.value.participationSummary.maybe;

  const mapImage =
    event.value.mapImageUrl ?? "https://picsum.photos/600/600?grayscale";

  const showParticipantsModal = useSignal(false);

  return (
    <div class="min-h-screen bg-white">
      <div class="max-w-[1290px] mx-auto px-4 py-12">
        {/* ── Title ── */}
        <h1 class="font-['Rubik',sans-serif] font-bold text-[48px] md:text-[64px] leading-[1.1] text-center text-black mb-8">
          {event.value.title}
        </h1>

        {/* ── Description ── */}
        {event.value.body && (
          <p class="max-w-3xl mx-auto text-center text-gray-700 text-base leading-relaxed mb-10">
            {event.value.body}
          </p>
        )}

        {/* ── CTA Button ── */}
        {!event.value.isEventPast && (
          <div class="flex justify-center mb-12">
            {!event.value.isLoggedIn ? (
              <a
                href="/login"
                class="inline-block px-10 py-3 bg-[#0e1148] hover:bg-[#1a1d5e] text-white font-['Lato',sans-serif] font-bold text-sm rounded-full transition-colors"
              >
                Log In to RSVP
              </a>
            ) : showBuyTickets ? (
              <Link
                href={`/events/${event.value.id}/checkout`}
                class="inline-block px-10 py-3 bg-[#0e1148] hover:bg-[#1a1d5e] text-white font-['Lato',sans-serif] font-bold text-sm rounded-full transition-colors"
              >
                Buy Your Tickets
              </Link>
            ) : showFreeRSVP ? (
              <Form action={rsvpWithTicket} class="flex gap-3">
                <input
                  type="hidden"
                  name="productId"
                  value={event.value.products[0]?.id}
                />
                <button
                  type="submit"
                  name="status"
                  value="yes"
                  class="px-10 py-3 bg-[#0e1148] hover:bg-[#1a1d5e] text-white font-['Lato',sans-serif] font-bold text-sm rounded-full transition-colors"
                >
                  {event.value.userParticipation?.status === "yes"
                    ? "✓ You're Going!"
                    : "RSVP — I'm Going"}
                </button>
              </Form>
            ) : showWaitlist ? (
              <Form action={updateParticipation}>
                <button
                  type="submit"
                  name="status"
                  value="maybe"
                  class="px-10 py-3 bg-[#0e1148] hover:bg-[#1a1d5e] text-white font-['Lato',sans-serif] font-bold text-sm rounded-full transition-colors"
                >
                  {event.value.userParticipation?.status === "maybe"
                    ? "✓ On Waitlist"
                    : "Join Waitlist"}
                </button>
              </Form>
            ) : showSalesClosed ? (
              <span class="inline-block px-10 py-3 bg-gray-400 text-white font-['Lato',sans-serif] font-bold text-sm rounded-full cursor-not-allowed">
                Sales Closed
              </span>
            ) : event.value.soldOut ? (
              <span class="inline-block px-10 py-3 bg-orange-500 text-white font-['Lato',sans-serif] font-bold text-sm rounded-full cursor-not-allowed">
                Sold Out
              </span>
            ) : (
              <Form action={updateParticipation}>
                <ParticipationToggle
                  currentStatus={event.value.userParticipation?.status || null}
                  onStatusChange={$((status: "yes" | "no" | "maybe") => {
                    updateParticipation.submit({ status });
                  })}
                />
              </Form>
            )}
          </div>
        )}

        {/* RSVP confirmation messages */}
        {event.value.userParticipation?.status === "yes" && showFreeRSVP && (
          <div class="max-w-xl mx-auto mb-8 p-3 bg-green-50 border border-green-200 rounded-lg text-green-800 text-center text-sm">
            ✓ You're attending! Your free ticket has been created.
          </div>
        )}
        {event.value.userParticipation?.status === "maybe" && showWaitlist && (
          <div class="max-w-xl mx-auto mb-8 p-3 bg-blue-50 border border-blue-200 rounded-lg text-blue-800 text-center text-sm">
            ✓ You're on the waitlist!
          </div>
        )}

        {/* ── Feature Grid ── */}
        <FeatureGrid gap={20}>
          {/* Top-left: Save the Date */}
          <EventDateTile
            area="left-top"
            startDate={startDate}
            endDate={endDate}
            variant="dark"
            title={event.value.title}
            location={event.value.locationDisplay}
            description={event.value.body || undefined}
            isPast={event.value.isEventPast}
          />

          {/* Center: Location Map */}
          {event.value.locationDisplay ? (
            <LocationTile
              area="middle"
              image={mapImage}
              location={event.value.locationDisplay}
            />
          ) : (
            <ImageTile
              area="middle"
              image="https://picsum.photos/600/700"
              alt="Event"
            />
          )}

          {/* Top-right: Event Image */}
          <ImageTile
            area="right-top"
            image="https://picsum.photos/400/500"
            alt={event.value.title}
          />

          {/* Bottom-left: Event Image */}
          <ImageTile
            area="left-bottom"
            image="https://picsum.photos/400/400"
            alt={event.value.title}
          />

          {/* Bottom-right: Participants */}
          <ParticipantsTile
            area="right-bottom"
            participants={event.value.participants}
            participantCount={participantCount}
            eventName={event.value.title}
            isLoggedIn={event.value.isLoggedIn}
            onSeeAll$={$(() => {
              showParticipantsModal.value = true;
            })}
            variant="dark"
          />
        </FeatureGrid>

        {/* Participants modal */}
        {showParticipantsModal.value && (
          <ParticipantsModal
            participants={event.value.participants}
            eventName={event.value.title}
            onClose$={$(() => {
              showParticipantsModal.value = false;
            })}
          />
        )}

        {/* ── Tickets / What's Included Section ── */}
        {hasProducts && !event.value.isEventPast && (
          <div class="max-w-4xl mx-auto mt-16">
            <h2 class="font-['Rubik',sans-serif] font-bold text-[32px] leading-[1.3] text-black mb-6">
              Tickets
            </h2>
            <p class="text-gray-700 text-base leading-relaxed mb-4">
              What is included in your tickets:
            </p>
            <div class="space-y-4">
              {event.value.products.map((product) => (
                <div key={product.id} class="flex items-start gap-3">
                  <span class="text-gray-400 mt-0.5">•</span>
                  <div>
                    <span class="font-medium text-gray-900">
                      {product.name}
                    </span>
                    {product.price > 0 && (
                      <span class="text-gray-500 ml-2">
                        — €{(product.price / 100).toFixed(2)}
                      </span>
                    )}
                    {product.features &&
                      (product.features as string[]).length > 0 && (
                        <ul class="mt-1 ml-2 space-y-1">
                          {(product.features as string[]).map(
                            (feature, idx) => (
                              <li
                                key={idx}
                                class="text-sm text-gray-600 flex items-start gap-2"
                              >
                                <span class="text-gray-300">·</span>
                                {feature}
                              </li>
                            ),
                          )}
                        </ul>
                      )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Photo Gallery (past events, verified attendees) ── */}
        {event.value.isEventPast && event.value.hasAttended && (
          <div class="max-w-4xl mx-auto mt-16 bg-purple-50 border border-purple-200 rounded-[25px] p-8">
            <h3 class="font-['Rubik',sans-serif] font-semibold text-[24px] text-purple-900 mb-3">
              📸 Event Photos
            </h3>
            <p class="text-purple-800 mb-6">
              You attended this event! View the photo gallery with all the
              memories.
            </p>
            <Link
              href={`/events/${event.value.id}/photos`}
              class="inline-block bg-purple-600 hover:bg-purple-700 text-white font-medium px-6 py-3 rounded-full transition-colors"
            >
              View Photo Gallery
            </Link>
          </div>
        )}

        {/* ── Organizer ── */}
        <div class="max-w-4xl mx-auto mt-16">
          <h2 class="font-['Rubik',sans-serif] font-bold text-[24px] leading-[1.3] text-black mb-4">
            Organized by
          </h2>
          <div class="flex items-center gap-4">
            <div class="w-12 h-12 bg-[#034ea2] text-white rounded-full flex items-center justify-center font-semibold text-lg">
              {event.value.user.displayName.charAt(0).toUpperCase()}
            </div>
            <div>
              <div class="font-medium text-gray-900 text-lg">
                {event.value.user.displayName}
              </div>
              {event.value.user.email && (
                <a
                  href={`mailto:${event.value.user.email}`}
                  class="text-sm text-gray-500 hover:text-blue-600"
                >
                  {event.value.user.email}
                </a>
              )}
            </div>
          </div>
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
