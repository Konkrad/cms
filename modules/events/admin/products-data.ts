import type { RequestEventLoader } from "@qwik.dev/router";
import { inventoryGroupsService } from "../services/inventory-groups";
import { requireAdminEvent } from "./auth";

/** Server-only: import from route loaders only, never from components. */
export async function loadAdminProducts(event: RequestEventLoader) {
	const { event: target } = await requireAdminEvent(event);
	const groups = await inventoryGroupsService.getByEventId(target.id);
	return {
		groups: groups as Array<{
			id: string;
			eventId: string;
			name: string;
			maxCapacity: number;
			needsTicket: boolean;
			salesStartDate?: string | null;
			salesEndDate?: string | null;
			createdAt: string;
			products?: any[];
		}>,
		eventId: target.id,
	};
}

export type AdminProductsData = Awaited<ReturnType<typeof loadAdminProducts>>;
