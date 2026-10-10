import type { RequestEventLoader } from "@qwik.dev/router";
import { ticketsService } from "../services/tickets";
import { requireAdminEvent } from "./auth";

/** Server-only: import from route loaders only, never from components. */
export async function loadAdminTickets(event: RequestEventLoader) {
	const { event: target } = await requireAdminEvent(event);
	const tickets = await ticketsService.getByEventId(target.id);
	return { eventId: target.id, tickets };
}

export type AdminTicketsData = Awaited<ReturnType<typeof loadAdminTickets>>;
