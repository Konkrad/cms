import { useSignal, useTask$ } from "@qwik.dev/core";
import { type RequestEventCommon, server$ } from "@qwik.dev/router";
import type { ProfileElectionGroup } from "~/contracts/profile";
import { assertNoPrivateFields, requireModuleAuth } from "~/core";
import { electionsService } from "./service";

/**
 * The viewer's own applications, grouped by cycle, newest year first. Private: only for the
 * viewer themselves; for another user's page (`userId` not the viewer) it is empty.
 */
const fetchOwnElectionHistory = server$(async function (
	userId?: string,
): Promise<ProfileElectionGroup[]> {
	const user = await requireModuleAuth(this as RequestEventCommon, "elections");
	if (userId !== undefined && userId !== user.id) return [];
	const applications = await electionsService.getApplicationsByUser(user.id);
	const byCycle = new Map<string, ProfileElectionGroup>();
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
	return assertNoPrivateFields(
		[...byCycle.values()].sort((a, b) => b.year - a.year),
	);
});

/**
 * Election history for the own profile (`profile.sections`), or for `/users/<userId>` when that
 * is the viewer's own page (`userPage.sections`; nothing on other users' pages).
 */
export function useElectionHistory(userId?: string) {
	const groups = useSignal<ProfileElectionGroup[]>([]);
	useTask$(async () => {
		groups.value = await fetchOwnElectionHistory(userId);
	});
	return groups;
}
