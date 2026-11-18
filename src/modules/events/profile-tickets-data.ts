import type { RequestEventLoader } from "@qwik.dev/router";
import { requireModuleAuth } from "~/core";
import { participantsService } from "./services/participants";
import { ticketsService } from "./services/tickets";
import { transactionsService } from "./services/transactions";

/** Server-only: import from route loaders only, never from components. */
export async function loadUserDashboard(event: RequestEventLoader) {
	const userData = await requireModuleAuth(event, "events");

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
}

export type UserDashboardData = Awaited<ReturnType<typeof loadUserDashboard>>;
