import {
	type PeopleBreakdownResult,
	suppressSmall,
} from "~/core/statistics/suppress";
import { activeModules } from "./manifests";

/**
 * The active modules' breakdowns of these people (`statistics` in the manifest), e.g. by
 * qualification, with small groups hidden. Server-only; exported to modules via `~/core`.
 */
export async function peopleBreakdowns(
	userIds: readonly string[],
): Promise<PeopleBreakdownResult[]> {
	const unique = [...new Set(userIds)];
	const breakdowns = activeModules.flatMap((m) => m.statistics ?? []);
	return Promise.all(
		breakdowns.map(async (breakdown) => {
			const groups = await breakdown.count(unique);
			const counts = suppressSmall(groups);
			return {
				id: breakdown.id,
				title: breakdown.title(),
				rows: groups.map((g, i) => ({
					label: g.label,
					count: counts[i].count,
				})),
			};
		}),
	);
}
