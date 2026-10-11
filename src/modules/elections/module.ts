import { defineModule } from "~/core";
import { electionsPages } from "./pages";
import { electionsService } from "./service";

export const electionsModule = defineModule({
	id: "elections",
	pages: electionsPages,
	// Election cycles are owned by a scope; each scope's admin manages its own and its subtree's.
	admin: {
		sections: [
			{ path: "elections", label: "Elections", order: 200, scopes: "all" },
		],
	},
	menuLinks: [{ key: "elections", label: "Elections", url: "/elections" }],
	// `elections:cycle:<id>` → `<scope path>/elections/<id>`.
	refs: {
		cycle: {
			label: "Election",
			path: "/elections/:id",
			locate: (ids) => electionsService.locate(ids),
			search: (query, limit) => electionsService.searchPublished(query, limit),
		},
	},
	// Election history is private: only the profile owner gets it.
	async profile({ userId, isOwnProfile }) {
		if (!isOwnProfile) return {};
		const applications = await electionsService.getApplicationsByUser(userId);

		const byCycle = new Map<
			string,
			{
				title: string;
				year: number;
				apps: { id: string; status: string; position: { title: string } }[];
			}
		>();
		for (const app of applications) {
			let group = byCycle.get(app.cycleId);
			if (!group) {
				group = { title: app.cycle.title, year: app.cycle.year, apps: [] };
				byCycle.set(app.cycleId, group);
			}
			group.apps.push({
				id: app.id,
				status: app.status,
				position: { title: app.position.title },
			});
		}
		return {
			electionGroups: [...byCycle.values()].sort((a, b) => b.year - a.year),
		};
	},
});
