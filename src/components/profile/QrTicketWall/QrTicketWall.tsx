import { component$, useSignal, useVisibleTask$, $ } from "@qwik.dev/core";
import type { events, products } from "~/db/schema";
import type { Ticket } from "~/db/schemas/tickets";
import type { TicketParticipant } from "~/db/schemas/ticket-participants";
import { Modal } from "~/components/ui/Modal";
import { SectionCard } from "~/components/ui/SectionCard";

interface TicketWithRelations extends Ticket {
  event: typeof events.$inferSelect;
  product: typeof products.$inferSelect;
  participants: TicketParticipant[];
}

interface QrTicketWallProps {
  tickets: TicketWithRelations[];
  buyerUserId: string;
  qrBust: Record<string, string>;
}

function groupByEvent(tickets: TicketWithRelations[]) {
  const map = new Map<
    string,
    { event: typeof events.$inferSelect; tickets: TicketWithRelations[] }
  >();
  for (const ticket of tickets) {
    const existing = map.get(ticket.eventId);
    if (existing) {
      existing.tickets.push(ticket);
    } else {
      map.set(ticket.eventId, { event: ticket.event, tickets: [ticket] });
    }
  }
  return Array.from(map.values());
}

function formatEventDate(dateString: string) {
  return new Date(dateString).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default component$<QrTicketWallProps>(
  ({ tickets, buyerUserId, qrBust }) => {
    const selectedEventId = useSignal<string | null>(null);
    const carouselIndex = useSignal(0);
    const carouselRef = useSignal<HTMLElement>();

    // Auto-focus the carousel div for keyboard navigation
    // eslint-disable-next-line qwik/no-use-visible-task
    useVisibleTask$(({ track }) => {
      track(() => selectedEventId.value);
      if (selectedEventId.value !== null) {
        carouselRef.value?.focus();
      }
    });

    const eventGroups = groupByEvent(tickets);

    // Reactive: reads selectedEventId.value so the component re-evaluates when it changes
    const currentGroup =
      selectedEventId.value !== null
        ? (eventGroups.find((g) => g.event.id === selectedEventId.value) ??
          null)
        : null;
    const currentTickets = currentGroup?.tickets ?? [];
    const safeIdx = Math.min(
      carouselIndex.value,
      Math.max(0, currentTickets.length - 1),
    );
    const currentTicket = currentTickets[safeIdx] ?? null;

    if (tickets.length === 0) return <></>;

    return (
      <SectionCard title="My Tickets">
        <div class="space-y-3">
          {eventGroups.map((group) => (
            <button
              key={group.event.id}
              type="button"
              data-event-id={group.event.id}
              onClick$={(_, btn) => {
                selectedEventId.value = (btn as HTMLButtonElement).dataset["eventId"]!;
                carouselIndex.value = 0;
              }}
              class="w-full text-left relative rounded-xl border border-gray-200 bg-white hover:border-gray-400 hover:shadow-sm transition-all p-4"
            >
              {/* Ticket count badge */}
              <span class="absolute top-3 right-3 flex items-center justify-center min-w-[1.5rem] h-6 px-1.5 rounded-full bg-gray-900 text-white text-xs font-semibold">
                {group.tickets.length}
              </span>
              <span class="block font-semibold text-gray-900 pr-10">
                {group.event.title}
              </span>
              <span class="block text-sm text-gray-500 mt-0.5">
                {formatEventDate(group.event.startDate)}
              </span>
            </button>
          ))}
        </div>

        {/* QR Carousel Modal */}
        {selectedEventId.value !== null && currentTicket !== null && (
          <Modal
            open={true}
            onClose$={$(() => {
              selectedEventId.value = null;
            })}
            title={currentGroup?.event.title}
            size="md"
          >
            <div
              ref={carouselRef}
              tabIndex={0}
              class="outline-none"
              onKeyDown$={(e) => {
                if (e.key === "ArrowLeft") {
                  carouselIndex.value = Math.max(0, carouselIndex.value - 1);
                } else if (e.key === "ArrowRight") {
                  carouselIndex.value = Math.min(
                    currentTickets.length - 1,
                    carouselIndex.value + 1,
                  );
                }
              }}
            >
              <div class="text-center space-y-5 py-2">
                {/* QR code image */}
                <div class="inline-block bg-white border border-gray-100 rounded-xl p-3 shadow-sm">
                  <img
                    src={`/profile/tickets/${currentTicket.id}_${qrBust[currentTicket.id] ?? currentTicket.qrCodeUuid}`}
                    alt="Ticket QR Code"
                    class="w-64 h-64 block"
                  />
                </div>

                {/* Ticket info */}
                <div>
                  <p class="font-semibold text-gray-900">
                    {currentTicket.product.name}
                  </p>
                  {currentTicket.participants[0] && (
                    <p class="text-sm text-gray-500 mt-0.5">
                      {currentTicket.participants[0].userId === buyerUserId
                        ? "You"
                        : currentTicket.participants[0].name}
                    </p>
                  )}
                  {currentTicket.scannedAt && (
                    <span class="inline-flex items-center gap-1 mt-2 px-2 py-0.5 rounded-full bg-green-50 border border-green-200 text-xs text-green-700 font-medium">
                      ✓ Already scanned
                    </span>
                  )}
                </div>

                {/* Prev / Next navigation */}
                {currentTickets.length > 1 && (
                  <div class="flex items-center justify-center gap-4">
                    <button
                      type="button"
                      disabled={carouselIndex.value === 0}
                      onClick$={() => {
                        carouselIndex.value = Math.max(
                          0,
                          carouselIndex.value - 1,
                        );
                      }}
                      class="p-2 rounded-full border border-gray-200 hover:bg-gray-50 disabled:opacity-30 transition-colors"
                      aria-label="Previous ticket"
                    >
                      <svg
                        class="w-5 h-5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          stroke-width="2"
                          d="M15 19l-7-7 7-7"
                        />
                      </svg>
                    </button>

                    <span class="text-sm text-gray-500 tabular-nums">
                      {carouselIndex.value + 1} / {currentTickets.length}
                    </span>

                    <button
                      type="button"
                      disabled={
                        carouselIndex.value === currentTickets.length - 1
                      }
                      onClick$={() => {
                        carouselIndex.value = Math.min(
                          currentTickets.length - 1,
                          carouselIndex.value + 1,
                        );
                      }}
                      class="p-2 rounded-full border border-gray-200 hover:bg-gray-50 disabled:opacity-30 transition-colors"
                      aria-label="Next ticket"
                    >
                      <svg
                        class="w-5 h-5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          stroke-width="2"
                          d="M9 5l7 7-7 7"
                        />
                      </svg>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </Modal>
        )}
      </SectionCard>
    );
  },
);
