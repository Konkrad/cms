import type { RequestEventLoader } from "@qwik.dev/router";
import { publicImageUrlFromKey } from "~/core-api";
import { dealsService } from "../service";
import { requireDealsAdmin } from "./auth";

/** Server-only: import from route loaders only, never from components. */
/** Returns the deal and its logo URL, or null when it does not exist (the route then redirects). */
export async function loadAdminDeal(event: RequestEventLoader) {
	await requireDealsAdmin(event);
	const deal = await dealsService.getById(event.params.id);
	if (!deal) return null;
	return { deal, logoUrl: publicImageUrlFromKey(deal.logo) };
}

export type AdminDealData = NonNullable<
	Awaited<ReturnType<typeof loadAdminDeal>>
>;
