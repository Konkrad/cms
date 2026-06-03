import { component$, useStore } from "@qwik.dev/core";
import { routeLoader$, routeAction$, z, zod$ } from "@qwik.dev/router";
import { transactionsService } from "~/services/transactions.service";
import { ticketsService } from "~/services/tickets.service";
import { participantsService } from "~/services/participants.service";
import QrTicketWall from "~/components/profile/QrTicketWall";
import PurchaseList from "~/components/profile/PurchaseList";
import { getCurrentUserData, requireAuth } from "~/utils/server-auth";

export const useUpdateParticipants = routeAction$(
  async (input, event) => {
    await requireAuth(event);
    const userData = await getCurrentUserData(event);
    if (!userData) throw event.redirect(302, "/login");

    // Verify the user owns this ticket
    const ticket = await ticketsService.getById(input.ticketId);
    if (!ticket || ticket.buyerId !== userData.id) {
      return { failed: true, message: "Ticket not found" };
    }

    const slots = JSON.parse(input.slots) as Array<{
      name: string;
      email: string;
    }>;

    await participantsService.replaceForTicket(input.ticketId, slots);
    // Rotate the QR code UUID so the old QR image is invalidated
    const updated = await ticketsService.rotateQrCode(input.ticketId);
    return { success: true, newQrCodeUuid: updated?.qrCodeUuid ?? null };
  },
  zod$({
    ticketId: z.string(),
    /** JSON-encoded array of { name, email } */
    slots: z.string(),
  }),
);

export const useUserDashboard = routeLoader$(async (event) => {
  await requireAuth(event);
  const userData = await getCurrentUserData(event);

  if (!userData) {
    throw event.redirect(302, "/login");
  }

  const userId = userData.id;
  const userEmail = userData.email ?? "";

  const [transactions, tickets, assignedTickets] = await Promise.all([
    transactionsService.getByUserId(userId),
    ticketsService.getByBuyerId(userId),
    userEmail ? participantsService.getAssignedTickets(userEmail) : [],
  ]);

  // Exclude assigned tickets that the user also bought (avoid duplicates)
  const ownTicketIds = new Set(tickets.map((t) => t.id));
  const filteredAssigned = (assignedTickets as any[]).filter(
    (t) => !ownTicketIds.has(t.id),
  );

  // QR wall: show tickets assigned to self, or to an external user (no platform account)
  // Hide tickets assigned to another registered user — they hold their own QR
  const myQrTickets = [
    ...tickets.filter((t) => {
      const p0 = t.participants[0];
      if (!p0) return false;
      return p0.userId === userId || p0.userId === null;
    }),
    ...filteredAssigned,
  ];

  // Build ticket map and attach to transactions
  const ticketsByTxId = new Map<string, (typeof tickets)[number][]>();
  for (const t of tickets) {
    const arr = ticketsByTxId.get(t.transactionId) ?? [];
    arr.push(t);
    ticketsByTxId.set(t.transactionId, arr);
  }

  const now = new Date();
  const transactionsWithTickets = transactions
    .map((tx) => ({ ...tx, tickets: ticketsByTxId.get(tx.id) ?? [] }))
    .sort((a, b) => {
      const aDate = new Date(a.event.startDate);
      const bDate = new Date(b.event.startDate);
      const aUpcoming = aDate >= now;
      const bUpcoming = bDate >= now;
      if (aUpcoming !== bUpcoming) return aUpcoming ? -1 : 1;
      return aUpcoming
        ? aDate.getTime() - bDate.getTime()
        : bDate.getTime() - aDate.getTime();
    });

  return {
    myQrTickets,
    transactions: transactionsWithTickets,
    buyerUserId: userId,
  };
});

export default component$(() => {
  const dashboard = useUserDashboard();
  const updateParticipants = useUpdateParticipants();
  const qrBust = useStore<Record<string, string>>({});

  return (
    <div class="max-w-2xl mx-auto px-4 py-8">
      <div class="mb-8">
        <h1 class="text-3xl font-bold mb-2">My Tickets & Purchases</h1>
        <p class="text-gray-600">View your tickets and manage your purchases</p>
      </div>

      <div class="space-y-8">
        <QrTicketWall
          tickets={dashboard.value.myQrTickets}
          buyerUserId={dashboard.value.buyerUserId}
          qrBust={qrBust}
        />
        <PurchaseList
          transactions={dashboard.value.transactions}
          buyerUserId={dashboard.value.buyerUserId}
          updateParticipantsAction={updateParticipants}
          qrBust={qrBust}
        />
      </div>
    </div>
  );
});

