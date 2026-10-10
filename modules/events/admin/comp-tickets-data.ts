import type { RequestEventLoader } from "@qwik.dev/router";
import { productsService } from "../services/products";
import { requireCompTicketsAdmin } from "./event-guards";

/** Server-only: import from route loaders only, never from components. */
export async function loadAdminCompTickets(event: RequestEventLoader) {
	const { event: target } = await requireCompTicketsAdmin(event);
	return {
		event: { id: target.id, title: target.title },
		products: await productsService.getByEventId(target.id),
	};
}

export type AdminCompTicketsData = Awaited<
	ReturnType<typeof loadAdminCompTickets>
>;
