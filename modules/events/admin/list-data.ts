import type { RequestEventLoader } from "@qwik.dev/router";
import { and, desc, eq, isNull, like, or, sql } from "drizzle-orm";
import {
	db,
	groupsService,
	requireModuleAdmin,
	users as usersTable,
} from "~/core-api";
import { PAGE_SIZE } from "~/ui";
import { events } from "../schema/events";
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

	const where = and(
		isNull(events.deletedAt),
		group ? eq(events.groupId, group.id) : undefined,
		search
			? or(like(events.title, `%${search}%`), like(events.city, `%${search}%`))
			: undefined,
	);

	const [countRows, rawItems] = await Promise.all([
		db.select({ total: sql<number>`COUNT(*)` }).from(events).where(where),
		db
			.select({
				id: events.id,
				title: events.title,
				startDate: events.startDate,
				visibility: events.visibility,
				groupId: events.groupId,
				userName: usersTable.name,
				userFamilyName: usersTable.familyName,
			})
			.from(events)
			.leftJoin(usersTable, eq(events.userId, usersTable.id))
			.where(where)
			.orderBy(desc(events.startDate))
			.limit(PAGE_SIZE)
			.offset(offset),
	]);

	const total = Number(countRows[0]?.total ?? 0);

	const eventsWithParticipation = await Promise.all(
		rawItems.map(async (e) => ({
			id: e.id,
			title: e.title,
			startDate: e.startDate,
			visibility: e.visibility,
			organizerName: `${e.userName ?? ""} ${e.userFamilyName ?? ""}`.trim(),
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
