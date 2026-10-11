import type { RequestEventLoader } from "@qwik.dev/router";
import { requireModuleAdmin, toPublicUser } from "~/core";
import { PAGE_SIZE } from "~/core/ui";
import { electionsService } from "../service";

/** Server-only: import from route loaders only, never from components. */

export async function loadAdminElections(event: RequestEventLoader) {
	await requireModuleAdmin(event, { module: "elections", scope: "global" });

	const search = event.url.searchParams.get("search")?.trim() ?? "";
	const page = Math.max(
		1,
		parseInt(event.url.searchParams.get("page") ?? "1", 10) || 1,
	);

	const all = await electionsService.getCycles();
	const filtered = search
		? all.filter((c) => c.title.toLowerCase().includes(search.toLowerCase()))
		: all;

	const total = filtered.length;
	const cycles = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

	return { cycles, total, page, pageSize: PAGE_SIZE, search };
}

/** Guard for the create-cycle form, which loads no data. */
export async function guardNewElection(event: RequestEventLoader) {
	await requireModuleAdmin(event, { module: "elections", scope: "global" });
	return {};
}

export async function loadAdminCycle(event: RequestEventLoader) {
	await requireModuleAdmin(event, { module: "elections", scope: "global" });
	const cycle = await electionsService.getCycleById(event.params.id);
	if (!cycle) throw event.redirect(302, "/admin/root/elections");
	const applications = await electionsService.getApplicationsByCycle(cycle.id);
	return {
		cycle,
		// The admin table shows the applicant's name only; keep the rest of the users row server-side.
		applications: applications.map(({ user, ...app }) => ({
			...app,
			user: toPublicUser(user),
		})),
	};
}

export async function loadAdminNewPosition(event: RequestEventLoader) {
	await requireModuleAdmin(event, { module: "elections", scope: "global" });
	const cycle = await electionsService.getCycleById(event.params.id);
	if (!cycle) throw event.redirect(302, "/admin/root/elections");
	if (cycle.status !== "draft") {
		throw event.redirect(302, `/admin/root/elections/${event.params.id}`);
	}
	return { cycle };
}

export type AdminElectionsData = Awaited<ReturnType<typeof loadAdminElections>>;
export type AdminCycleData = Awaited<ReturnType<typeof loadAdminCycle>>;
export type AdminNewPositionData = Awaited<
	ReturnType<typeof loadAdminNewPosition>
>;
