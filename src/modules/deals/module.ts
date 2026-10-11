import { defineModule, scopeContentFilter } from "~/core";
import { dealsBlocks } from "./blocks";
import { dealsPages } from "./pages";
import { dealsService } from "./service";

export const dealsModule = defineModule({
	id: "deals",
	pages: dealsPages,
	// Deals are owned by a scope; each scope's admin manages its own and its subtree's.
	admin: {
		sections: [{ path: "deals", label: "Deals", order: 100, scopes: "all" }],
	},
	blocks: dealsBlocks,
	sitemap: async () =>
		// The root listing: every deal of every scope.
		(await dealsService.getActive(await scopeContentFilter(null))).map(
			(deal) => ({
				path: `/deals/${deal.id}`,
				lastmod: deal.updatedAt,
			}),
		),
});
