import { defineModule } from "~/core";
import { dealsBlocks } from "./blocks";
import { dealsPages } from "./pages";
import { dealsService } from "./service";

export const dealsModule = defineModule({
	id: "deals",
	pages: dealsPages,
	admin: { sections: [{ path: "deals", label: "Deals", order: 100 }] },
	blocks: dealsBlocks,
	sitemap: async () =>
		(await dealsService.getActive()).map((deal) => ({
			path: `/deals/${deal.id}`,
			lastmod: deal.updatedAt,
		})),
});
