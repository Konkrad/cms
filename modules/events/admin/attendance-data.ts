import type { RequestEventLoader } from "@qwik.dev/router";
import { ticketsService } from "../services/tickets";
import { requireAdminEvent } from "./auth";

/** Server-only: import from route loaders only, never from components. */
export async function loadAdminAttendance(event: RequestEventLoader) {
	const { event: target } = await requireAdminEvent(event);
	const [stats, attendedTickets] = await Promise.all([
		ticketsService.getAttendanceStats(target.id),
		ticketsService.getAttendedTickets(target.id),
	]);
	return {
		event: { id: target.id, title: target.title },
		stats,
		attendedTickets,
	};
}

export type AdminAttendanceData = Awaited<
	ReturnType<typeof loadAdminAttendance>
>;
