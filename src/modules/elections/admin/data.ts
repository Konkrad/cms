import type { RequestEventLoader } from "@qwik.dev/router";
import {
	getSubtreeIds,
	requireModuleAdmin,
	requireWithinScope,
	toPublicUser,
} from "~/core";
import { PAGE_SIZE } from "~/core/ui";
import { electionsService } from "../service";

/** Server-only: import from route loaders only, never from components. */

const ELECTIONS = { module: "elections" } as const;

export async function loadAdminElections(event: RequestEventLoader) {
	const { scope, isRoot, adminBase } = await requireModuleAdmin(
		event,
		ELECTIONS,
	);

	const search = event.url.searchParams.get("search")?.trim() ?? "";
	const page = Math.max(
		1,
		parseInt(event.url.searchParams.get("page") ?? "1", 10) || 1,
	);

	// The root lists every cycle; other scopes their own and their subtree's.
	const all = await electionsService.getCycles(
		isRoot ? null : await getSubtreeIds(scope.id),
	);
	const filtered = search
		? all.filter((c) => c.title.toLowerCase().includes(search.toLowerCase()))
		: all;

	const total = filtered.length;
	const cycles = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

	return { cycles, total, page, pageSize: PAGE_SIZE, search, adminBase };
}

/** Guard for the create-cycle form, which loads no data. */
export async function guardNewElection(event: RequestEventLoader) {
	const { adminBase } = await requireModuleAdmin(event, ELECTIONS);
	return { adminBase };
}

/** A cycle of the URL scope's subtree (404 otherwise). */
async function loadScopedCycle(event: RequestEventLoader) {
	const access = await requireModuleAdmin(event, ELECTIONS);
	const cycle = await electionsService.getCycleById(event.params.id);
	await requireWithinScope(event, access.scope, cycle);
	return { cycle: cycle!, adminBase: access.adminBase };
}

export async function loadAdminCycle(event: RequestEventLoader) {
	const { cycle, adminBase } = await loadScopedCycle(event);
	const applications = await electionsService.getApplicationsByCycle(cycle.id);
	return {
		cycle,
		adminBase,
		// The admin table shows the applicant's name only; keep the rest of the users row server-side.
		applications: applications.map(({ user, ...app }) => ({
			...app,
			user: toPublicUser(user),
		})),
	};
}

export async function loadAdminNewPosition(event: RequestEventLoader) {
	const { cycle, adminBase } = await loadScopedCycle(event);
	if (cycle.status !== "draft") {
		throw event.redirect(302, `${adminBase}/elections/${event.params.id}`);
	}
	return { cycle, adminBase };
}

export type AdminElectionsData = Awaited<ReturnType<typeof loadAdminElections>>;
export type AdminNewElectionData = Awaited<ReturnType<typeof guardNewElection>>;
export type AdminCycleData = Awaited<ReturnType<typeof loadAdminCycle>>;
export type AdminNewPositionData = Awaited<
	ReturnType<typeof loadAdminNewPosition>
>;
