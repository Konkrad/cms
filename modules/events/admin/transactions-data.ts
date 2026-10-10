import type { RequestEventLoader } from "@qwik.dev/router";
import { transactionsService } from "../services/transactions";
import { requireAdminEvent } from "./auth";

/** Server-only: import from route loaders only, never from components. */
export async function loadAdminTransactions(event: RequestEventLoader) {
	const { event: target } = await requireAdminEvent(event);
	const transactions = await transactionsService.getByEventIdWithDetails(
		target.id,
	);
	return { eventId: target.id, transactions };
}

export type AdminTransactionsData = Awaited<
	ReturnType<typeof loadAdminTransactions>
>;
