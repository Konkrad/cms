import type { Deal } from "./schema";

/** Deal list item for the page-builder block: no steps (they may hold login-gated promo codes). */
export function toDealListItem(deal: Deal) {
	return {
		id: deal.id,
		name: deal.name,
		description: deal.description,
		logo: deal.logo,
	};
}

/**
 * Deal for the public detail page. Steps flagged `requiresLogin` keep only their
 * title for guests: the text, link and promo code must not reach the HTML, since
 * the theme only blurs a locked step visually.
 */
export function toPublicDeal(deal: Deal, isLoggedIn: boolean) {
	return {
		id: deal.id,
		name: deal.name,
		description: deal.description,
		logo: deal.logo,
		validUntil: deal.validUntil,
		steps: deal.steps.map((step) =>
			step.requiresLogin && !isLoggedIn
				? {
						type: step.type,
						title: step.title,
						text: "",
						requiresLogin: true,
					}
				: step,
		),
	};
}
