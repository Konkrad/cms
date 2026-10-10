import type { RequestEventLoader } from "@qwik.dev/router";
import { groupsService, requireModuleAdmin } from "~/core";
import { PAGE_SIZE } from "~/core/ui";
import { eventsService } from "../services/events";
import { participationService } from "../services/participation";

/** Server-only: import from route loaders only, never from components. */
export async function loadAdminEvents(event: RequestEventLoader) {
	await requireModuleAdmin(event, { module: "events", scope: "any" });
	const { params, url } = event;
	const groupSlug = params.group_slug;
	const search = url.searchParams.get("search")?.trim() ?? "";
	const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1") || 1);
	const offset = (page - 1) * PAGE_SIZE;

	const group =
		groupSlug !== "global" ? await groupsService.getBySlug(groupSlug) : null;

	const { total, items } = await eventsService.adminList({
		groupId: group?.id ?? null,
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
		groupSlug,
	};
}

export type AdminEventsData = Awaited<ReturnType<typeof loadAdminEvents>>;
