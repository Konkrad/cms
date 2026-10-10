import type { RequestEventLoader } from "@qwik.dev/router";
import { PAGE_SIZE } from "~/ui";
import { dealsService } from "../service";
import { requireDealsAdmin } from "./auth";

/** Server-only: import from route loaders only, never from components. */
export async function loadAdminDeals(event: RequestEventLoader) {
	await requireDealsAdmin(event);

	const search = event.url.searchParams.get("search")?.trim() ?? "";
	const page = Math.max(
		1,
		parseInt(event.url.searchParams.get("page") ?? "1", 10) || 1,
	);

	const all = await dealsService.getAll();
	const filtered = search
		? all.filter(
				(d) =>
					d.name.toLowerCase().includes(search.toLowerCase()) ||
					(d.description ?? "").toLowerCase().includes(search.toLowerCase()),
			)
		: all;

	const total = filtered.length;
	const deals = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

	return { deals, total, page, pageSize: PAGE_SIZE, search };
}

export type AdminDealsData = Awaited<ReturnType<typeof loadAdminDeals>>;
