import { useSignal, useTask$ } from "@qwik.dev/core";
import { type RequestEventCommon, server$ } from "@qwik.dev/router";
import type { RequirementStepData } from "~/contracts/requirements";
import type { ScopeEventsData } from "~/contracts/scopes";
import {
	assertNoPrivateFields,
	currentUser,
	getSubtreeIds,
	requireActiveModule,
	requireModuleAdmin,
	requireModuleAuth,
	requirements,
} from "~/core";
import { eventsRequirements } from "./requirements";
import { eventsService } from "./services/events";
import {
	eventStatisticsService,
	type ScopeEventStatistics,
} from "./services/statistics";
import {
	type ProfileEventsData,
	profileEventsOf,
	scopeEventsFor,
} from "./slot-data";

const MODULE = "events";

const fetchOwnProfileEvents = server$(async function () {
	const user = await requireModuleAuth(this as RequestEventCommon, MODULE);
	return assertNoPrivateFields(await profileEventsOf(user.id));
});

const fetchUserPageEvents = server$(async function (userId: string) {
	// The public profile page is login-only; the events a user attends are public to members.
	await requireModuleAuth(this as RequestEventCommon, MODULE);
	return assertNoPrivateFields(await profileEventsOf(userId));
});

/** Upcoming and past events of a profile (`profile.sections`: own; `userPage.sections`: `userId`). */
export function useProfileEvents(userId?: string) {
	const data = useSignal<ProfileEventsData | null>(null);
	useTask$(async () => {
		data.value = userId
			? await fetchUserPageEvents(userId)
			: await fetchOwnProfileEvents();
	});
	return data;
}

const fetchScopeEvents = server$(async function (
	scopeId: string,
): Promise<ScopeEventsData> {
	requireActiveModule(this as RequestEventCommon, MODULE);
	const user = await currentUser(this as RequestEventCommon);
	return assertNoPrivateFields(await scopeEventsFor(scopeId, user));
});

/** The events section of a scope home page (`scopePage.sections`). */
export function useScopeEvents(scopeId: string) {
	const data = useSignal<ScopeEventsData | null>(null);
	useTask$(async () => {
		data.value = await fetchScopeEvents(scopeId);
	});
	return data;
}

const fetchEventSettings = server$(async function () {
	const user = await requireModuleAuth(this as RequestEventCommon, MODULE);
	const steps = await requirements.settings(
		user,
		eventsRequirements.map((r) => r.id),
	);
	// The viewer's OWN answers (food preference, photo consent), prefilled to change them.
	return assertNoPrivateFields(steps, {
		allow: ["foodPreference", "photoConsentGiven"],
	});
});

/** The events module's requirements as editable settings (`profile.settings`). */
export function useEventSettings() {
	const steps = useSignal<RequirementStepData[]>([]);
	useTask$(async () => {
		steps.value = await fetchEventSettings();
	});
	return steps;
}

const fetchDashboardEvents = server$(async function () {
	const { scope, isRoot } = await requireModuleAdmin(
		this as RequestEventCommon,
		{ module: MODULE },
	);
	// The root counts every scope's events; another scope its own subtree's.
	return {
		isRoot,
		count: await eventsService.countActiveInScopes(
			await getSubtreeIds(scope.id),
		),
	};
});

/** Event count for a scope's admin dashboard (`admin.dashboard.widgets`). */
export function useDashboardEvents() {
	const data = useSignal<{ isRoot: boolean; count: number } | null>(null);
	useTask$(async () => {
		data.value = await fetchDashboardEvents();
	});
	return data;
}

const fetchScopeEventStatistics = server$(async function () {
	const { scope } = await requireModuleAdmin(this as RequestEventCommon, {
		module: MODULE,
	});
	return assertNoPrivateFields(
		await eventStatisticsService.forScopes(
			await getSubtreeIds(scope.id),
			scope.id,
		),
	);
});

/** The events section of a scope's statistics page (`admin.statistics.sections`). */
export function useScopeEventStatistics() {
	const data = useSignal<ScopeEventStatistics | null>(null);
	useTask$(async () => {
		data.value = await fetchScopeEventStatistics();
	});
	return data;
}
