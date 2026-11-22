import {
	canViewScope,
	definePage,
	getServerSession,
	itemUrl,
	membershipsService,
	publicImageUrlFromKey,
	requireCanonicalUrl,
} from "~/core";
import { toPublicDeal } from "./public-deal";
import { dealsService } from "./service";

export const dealDetailPage = definePage({
	id: "deals.detail",
	path: "/deals/:id",
	async load(event, { params }) {
		// Public deals need no login. Login-gated steps are stripped for guests; a members-only
		// deal answers 404 to everyone who may not see it; a deal that requires a membership
		// tier shows its steps only to people with that tier (spec 4.2).
		const deal = await dealsService.getById(params.id);
		if (!deal) throw event.error(404, "Deal not found");
		const user = await getServerSession(event);
		if (
			deal.visibility !== "public" &&
			!(await canViewScope(user, deal.scopeId, deal.visibility))
		)
			throw event.error(404, "Deal not found");

		const now = new Date().toISOString();
		if (deal.validUntil && deal.validUntil < now) {
			throw event.error(404, "This deal is no longer available");
		}
		requireCanonicalUrl(event, await itemUrl("deals:deal", deal));

		const isLoggedIn = !!user;
		const hasRequiredTier =
			!deal.requiredMembershipTier ||
			(!!user &&
				(await membershipsService.hasTier(
					user.id,
					deal.requiredMembershipTier,
				)));
		return {
			deal: toPublicDeal(deal, isLoggedIn, hasRequiredTier),
			isLoggedIn,
			logoUrl: publicImageUrlFromKey(deal.logo),
		};
	},
});

export const dealsPages = [dealDetailPage];
