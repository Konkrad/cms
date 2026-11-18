import { defineModule, scopeContentFilter, t, withItemUrls } from "~/core";
import { dealsBlocks } from "./blocks";
import { dealsPages } from "./pages";
import dealsSchema from "./schema";
import { dealsService } from "./service";

export const dealsModule = defineModule({
	id: "deals",
	schema: dealsSchema,
	pages: dealsPages,
	// Deals are owned by a scope; each scope's admin manages its own and its subtree's.
	admin: {
		sections: [
			{
				path: "deals",
				label: t("deals.module.deals"),
				order: 100,
				scopes: "all",
			},
		],
	},
	blocks: dealsBlocks,
	// `deals:deal:<id>` → `<scope path>/deals/<id>`.
	refs: {
		deal: {
			label: t("deals.module.deal"),
			path: "/deals/:id",
			locate: (ids) => dealsService.locate(ids),
			search: (query, limit) => dealsService.searchActive(query, limit),
		},
	},
	sitemap: async () =>
		// The root listing: every deal of every scope, at its canonical URL.
		(
			await withItemUrls(
				"deals:deal",
				await dealsService.getActive(await scopeContentFilter(null)),
			)
		).map((deal) => ({ path: deal.url, lastmod: deal.updatedAt })),
	// Deal logos.
	uploads: [{ prefix: "public/deals/", minRole: "representative" }],
	// Demo deals and the Deals page; lazy (dev dependencies stay out of the server).
	seed: async (ctx) => (await import("./seed")).seedDeals(ctx),
});
