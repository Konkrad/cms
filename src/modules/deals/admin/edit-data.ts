import type { RequestEventLoader } from "@qwik.dev/router";
import {
	publicImageUrlFromKey,
	requireModuleAdmin,
	requireWithinScope,
} from "~/core";
import { dealsService } from "../service";

/**
 * Server-only: import from route loaders only, never from components. Returns the deal and its
 * logo URL; 404 when it does not exist or lies outside the URL scope's subtree.
 */
export async function loadAdminDeal(event: RequestEventLoader) {
	const { scope, adminBase } = await requireModuleAdmin(event, {
		module: "deals",
		scope: "any",
	});
	const deal = await dealsService.getById(event.params.id);
	await requireWithinScope(event, scope, deal);
	return {
		deal: deal!,
		logoUrl: publicImageUrlFromKey(deal!.logo),
		adminBase,
	};
}

export type AdminDealData = Awaited<ReturnType<typeof loadAdminDeal>>;
