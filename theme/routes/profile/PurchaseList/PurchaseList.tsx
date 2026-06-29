import { component$, useStore, $ } from "@qwik.dev/core";
import type { ActionStore } from "@qwik.dev/router";
import type { Transaction } from "~/db/schemas/transactions";
import type { Ticket } from "~/db/schemas/tickets";
import type { TicketParticipant } from "~/db/schemas/ticket-participants";
import type { events, products, transactionItems } from "~/db/schema";
import { SectionCard } from "~/components/ui/SectionCard";
import { ParticipantForm } from "~theme/shared/ParticipantForm";
import type { ParticipantFormSlot } from "~theme/shared/ParticipantForm";

interface TicketWithRelations extends Ticket {
  event: typeof events.$inferSelect;
  product: typeof products.$inferSelect;
  participants: TicketParticipant[];
}

interface TransactionWithTickets extends Transaction {
  event: typeof events.$inferSelect;
  items: Array<
    typeof transactionItems.$inferSelect & {
      product: typeof products.$inferSelect;
    }
  >;
  tickets: TicketWithRelations[];
}

interface PurchaseListProps {
  transactions: TransactionWithTickets[];
  buyerUserId: string;
  updateParticipantsAction: ActionStore<any, any, true>;
  qrBust: Record<string, string>;
}

// Must live outside the component to avoid non-serializable closure capture
function buildInitialSlots(ticket: TicketWithRelations): ParticipantFormSlot[] {
  const capacity = ticket.product.participantCapacity;
  return Array.from({ length: capacity }, (_, i) => {
    const p = ticket.participants[i];
    return p ? { name: p.name, email: p.email } : { name: "", email: "" };
  });
}

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
  }).format(amount);
}

export default component$<PurchaseListProps>(
  ({ transactions, buyerUserId, updateParticipantsAction, qrBust }) => {
    const expandedTxId = useStore<Record<string, boolean>>({});
    const expandedTicketId = useStore<Record<string, boolean>>({});
    const pendingSlots = useStore<Record<string, ParticipantFormSlot[]>>({});
    const saving = useStore<Record<string, boolean>>({});
    const saveError = useStore<Record<string, string>>({});

    const now = new Date();
    const upcoming = transactions.filter(
      (tx) => new Date(tx.event.startDate) >= now,
    );
    const past = transactions.filter(
      (tx) => new Date(tx.event.startDate) < now,
    );

    const renderTicket = (
      ticket: TicketWithRelations,
      isUpcoming: boolean,
    ) => {
      const p0 = ticket.participants[0];
      const isAssignedAway = !!p0 && p0.userId !== buyerUserId;
      const isExpanded = !!expandedTicketId[ticket.id];
      const slots = pendingSlots[ticket.id] ?? buildInitialSlots(ticket);

      return (
        <div
          key={ticket.id}
          class="rounded-lg border border-border bg-bg overflow-hidden"
        >
          <div class="flex items-center justify-between gap-3 px-3 py-2.5">
            <div class="min-w-0">
              <p class="text-sm font-medium text-text truncate">
                {ticket.product.name}
              </p>
              {p0 && (
                <span class={`inline-flex items-center gap-1 mt-0.5 text-xs ${isAssignedAway ? "text-warning" : "text-text-muted"}`}>
                  {isAssignedAway ? `→ ${p0.name}` : "You"}
                </span>
              )}
              {ticket.scannedAt && (
                <span class="inline-flex items-center gap-1 mt-0.5 text-xs text-success">
                  ✓ Scanned
                </span>
              )}
            </div>
            {isUpcoming && (
              <button
                type="button"
                onClick$={() => {
                  if (!isExpanded && !pendingSlots[ticket.id]) {
                    pendingSlots[ticket.id] = buildInitialSlots(ticket);
                  }
                  expandedTicketId[ticket.id] = !isExpanded;
                }}
                class="shrink-0 px-2.5 py-1 text-xs font-medium rounded-md border border-border text-text-secondary hover:bg-white transition-colors"
              >
                {isExpanded ? "Close" : "Reassign"}
              </button>
            )}
          </div>

          {isUpcoming && isExpanded && (
            <div class="border-t border-border bg-white px-3 py-3">
              <ParticipantForm
                slots={slots}
                totalSlots={ticket.product.participantCapacity}
                onSlotsChange$={$((newSlots) => {
                  pendingSlots[ticket.id] = newSlots as ParticipantFormSlot[];
                })}
              />

              {saveError[ticket.id] && (
                <p class="text-xs text-error mt-2">{saveError[ticket.id]}</p>
              )}

              <div class="flex justify-end gap-2 mt-3">
                <button
                  type="button"
                  class="text-xs px-3 py-1.5 rounded-md border border-border hover:bg-bg transition-colors"
                  onClick$={() => {
                    pendingSlots[ticket.id] = buildInitialSlots(ticket);
                    saveError[ticket.id] = "";
                  }}
                >
                  Reset
                </button>
                <button
                  type="button"
                  disabled={!!saving[ticket.id]}
                  class="text-xs px-3 py-1.5 rounded-md bg-text-heading text-white hover:bg-text disabled:opacity-40 transition-colors"
                  onClick$={async () => {
                    saving[ticket.id] = true;
                    saveError[ticket.id] = "";
                    const result = await updateParticipantsAction.submit({
                      ticketId: ticket.id,
                      slots: JSON.stringify(
                        (pendingSlots[ticket.id] ?? []).map((s) => ({
                          name: s.name,
                          email: s.email,
                        })),
                      ),
                    });
                    saving[ticket.id] = false;
                    if (result.value?.failed) {
                      saveError[ticket.id] =
                        result.value.message ?? "Save failed";
                    } else {
                      if (result.value?.newQrCodeUuid) {
                        qrBust[ticket.id] = result.value.newQrCodeUuid;
                      }
                      expandedTicketId[ticket.id] = false;
                    }
                  }}
                >
                  {saving[ticket.id] ? "Saving…" : "Save"}
                </button>
              </div>
            </div>
          )}
        </div>
      );
    };

    const renderGroup = (
      group: TransactionWithTickets[],
      label: string,
      isUpcoming: boolean,
    ) => {
      if (group.length === 0) return null;
      return (
        <div>
          <h4 class="text-xs font-semibold uppercase tracking-wider text-text-muted mb-3">
            {label}
          </h4>
          <div class="space-y-3">
            {group.map((tx) => {
              const isOpen = !!expandedTxId[tx.id];
              return (
                <div
                  key={tx.id}
                  class="rounded-xl border border-border bg-white shadow-sm overflow-hidden"
                >
                  {/* Purchase header — click to expand */}
                  <div
                    role="button"
                    tabIndex={0}
                    onClick$={() => {
                      expandedTxId[tx.id] = !isOpen;
                    }}
                    onKeyDown$={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        expandedTxId[tx.id] = !isOpen;
                      }
                    }}
                    class="w-full text-left px-4 py-3 cursor-pointer select-none"
                  >
                    <div class="flex items-start justify-between gap-3">
                      <div class="min-w-0">
                        <span class="block font-semibold text-text-heading truncate">
                          {tx.event.title}
                        </span>
                        <span class="block text-xs text-text-muted mt-0.5">
                          {formatDate(tx.event.startDate)}
                        </span>
                      </div>
                      <svg
                        class={`w-4 h-4 text-text-muted shrink-0 mt-1 transition-transform ${isOpen ? "rotate-180" : ""}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          stroke-width="2"
                          d="M19 9l-7 7-7-7"
                        />
                      </svg>
                    </div>

                    {/* Receipt line items */}
                    <div class="mt-2 space-y-0.5">
                      {tx.items.map((item) => (
                        <div
                          key={item.id}
                          class="flex items-center justify-between text-xs text-text-secondary"
                        >
                          <span>
                            {item.quantity}× {item.product.name}
                          </span>
                          <span class="tabular-nums">
                            {formatCurrency(item.unitPrice * item.quantity)}
                          </span>
                        </div>
                      ))}
                    </div>

                    {/* Total */}
                    <div class="mt-2 pt-2 border-t border-border flex items-center justify-between text-xs">
                      <span class="text-text-muted">
                        {tx.transactionFee > 0
                          ? `incl. ${formatCurrency(tx.transactionFee)} fee`
                          : "Free"}
                      </span>
                      <span class="font-semibold text-text-heading tabular-nums">
                        {formatCurrency(tx.totalAmount)}
                      </span>
                    </div>
                  </div>

                  {/* Tickets (expanded) */}
                  {isOpen && tx.tickets.length > 0 && (
                    <div class="border-t border-border px-3 pb-3 pt-2 space-y-2">
                      {tx.tickets.map((ticket) =>
                        renderTicket(ticket, isUpcoming),
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      );
    };

    if (transactions.length === 0) {
      return (
        <SectionCard title="Purchases">
          <p class="text-text-muted text-center py-8">No purchases yet</p>
        </SectionCard>
      );
    }

    return (
      <SectionCard title="Purchases">
        <div class="space-y-6">
          {renderGroup(upcoming, `Upcoming · ${upcoming.length}`, true)}
          {renderGroup(past, `Past · ${past.length}`, false)}
        </div>
      </SectionCard>
    );
  },
);
