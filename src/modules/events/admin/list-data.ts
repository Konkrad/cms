import type { RequestEventLoader } from "@qwik.dev/router";
import { getSubtreeIds, requireModuleAdmin } from "~/core";
import { PAGE_SIZE } from "~/core/ui";
import { eventsService } from "../services/events";
import { participationService } from "../services/participation";

/** Server-only: import from route loaders only, never from components. */
export async function loadAdminEvents(event: RequestEventLoader) {
	const { scope, isRoot, adminBase } = await requireModuleAdmin(event, {
		module: "events",
	});
	const { url } = event;
	const search = url.searchParams.get("search")?.trim() ?? "";
	const page = Math.max(
		1,
		parseInt(url.searchParams.get("page") ?? "1", 10) || 1,
	);
	const offset = (page - 1) * PAGE_SIZE;

	const { total, items } = await eventsService.adminList({
		// The root lists every event; other scopes their own and their subtree's.
		scopeIds: isRoot ? null : await getSubtreeIds(scope.id),
		search,
		limit: PAGE_SIZE,
		offset,
	});

	const eventsWithParticipation = await Promise.all(
		items.map(async (e) => ({
			...e,
			participationCounts: await participationService.getSummary(e.id),
		})),
	);

	return {
		events: eventsWithParticipation,
		total,
		page,
		pageSize: PAGE_SIZE,
		search,
		isRoot,
		adminBase,
	};
}

export type AdminEventsData = Awaited<ReturnType<typeof loadAdminEvents>>;
