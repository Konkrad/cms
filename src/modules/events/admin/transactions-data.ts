import type { RequestEventLoader } from "@qwik.dev/router";
import { transactionsService } from "../services/transactions";
import { requireAdminEvent } from "./event-guards";

/** Server-only: import from route loaders only, never from components. */
export async function loadAdminTransactions(event: RequestEventLoader) {
	const { event: target } = await requireAdminEvent(event);
	const transactions = await transactionsService.getByEventIdWithBuyerEmail(
		target.id,
	);
	return { eventId: target.id, transactions };
}

export type AdminTransactionsData = Awaited<
	ReturnType<typeof loadAdminTransactions>
>;
