import type { RequestEventLoader } from "@qwik.dev/router";
import { eventStatisticsService } from "../services/statistics";
import { requireAdminEvent } from "./event-guards";

/** Server-only: import from route loaders only, never from components. */
export async function loadAdminEventStatistics(event: RequestEventLoader) {
	const { event: target } = await requireAdminEvent(event);
	return {
		event: { id: target.id, title: target.title },
		stats: await eventStatisticsService.forEvent(target),
	};
}

export type AdminEventStatisticsData = Awaited<
	ReturnType<typeof loadAdminEventStatistics>
>;
