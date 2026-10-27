import { defineModule, t } from "~/core";
import { electionsPages } from "./pages";
import { electionsService } from "./service";

export const electionsModule = defineModule({
	id: "elections",
	pages: electionsPages,
	// Election cycles are owned by a scope; each scope's admin manages its own and its subtree's.
	admin: {
		sections: [
			{
				path: "elections",
				label: t("elections.module.elections"),
				order: 200,
				scopes: "all",
			},
		],
	},
	menuLinks: [
		{
			key: "elections",
			label: t("elections.module.elections"),
			url: "/elections",
		},
	],
	// `elections:cycle:<id>` → `<scope path>/elections/<id>`.
	refs: {
		cycle: {
			label: t("elections.module.election"),
			path: "/elections/:id",
			locate: (ids) => electionsService.locate(ids),
			search: (query, limit) => electionsService.searchPublished(query, limit),
		},
	},
	// Election history on the own profile (private: the owner only); components in slots.tsx.
	slots: ["profile.sections", "userPage.sections"],
	// E2E board elections; lazy (dev dependencies stay out of the server).
	seed: async (ctx) => (await import("./seed")).seedElections(ctx),
});
