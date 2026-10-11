import type { RequestEventLoader } from "@qwik.dev/router";
import { getSubtreeIds, requireModuleAdmin } from "~/core";
import { PAGE_SIZE } from "~/core/ui";
import { dealsService } from "../service";

/** Server-only: import from route loaders only, never from components. */
export async function loadAdminDeals(event: RequestEventLoader) {
	const { scope, isRoot, adminBase } = await requireModuleAdmin(event, {
		module: "deals",
		scope: "any",
	});

	const search = event.url.searchParams.get("search")?.trim() ?? "";
	const page = Math.max(
		1,
		parseInt(event.url.searchParams.get("page") ?? "1", 10) || 1,
	);

	// The root lists every deal; other scopes their own and their subtree's.
	const all = await dealsService.getAll(
		isRoot ? null : await getSubtreeIds(scope.id),
	);
	const filtered = search
		? all.filter(
				(d) =>
					d.name.toLowerCase().includes(search.toLowerCase()) ||
					(d.description ?? "").toLowerCase().includes(search.toLowerCase()),
			)
		: all;

	const total = filtered.length;
	const deals = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

	return { deals, total, page, pageSize: PAGE_SIZE, search, adminBase };
}

export type AdminDealsData = Awaited<ReturnType<typeof loadAdminDeals>>;
