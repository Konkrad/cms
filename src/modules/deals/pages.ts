import { definePage, getServerSession, publicImageUrlFromKey } from "~/core";
import { toPublicDeal } from "./public-deal";
import { dealsService } from "./service";

export const dealDetailPage = definePage({
	id: "deals.detail",
	path: "/deals/:id",
	async load(event, { params }) {
		// Public page: no login required. Login-gated steps are stripped for guests.
		const deal = await dealsService.getById(params.id);
		if (!deal) throw event.error(404, "Deal not found");

		const now = new Date().toISOString();
		if (deal.validUntil && deal.validUntil < now) {
			throw event.error(404, "This deal is no longer available");
		}

		const isLoggedIn = !!(await getServerSession(event));
		return {
			deal: toPublicDeal(deal, isLoggedIn),
			isLoggedIn,
			logoUrl: publicImageUrlFromKey(deal.logo),
		};
	},
});

export const dealsPages = [dealDetailPage];
