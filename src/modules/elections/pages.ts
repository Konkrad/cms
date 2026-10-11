import type { ElectionDetailViewData } from "~/contracts/elections";
import {
	definePage,
	itemUrl,
	membershipsService,
	requestContentFilter,
	requireAuth,
	requireCanonicalUrl,
	scopeUrl,
	withItemUrls,
} from "~/core";
import { toPublicCandidate } from "./public-election";
import { electionsService } from "./service";

export const electionsListPage = definePage({
	id: "elections.list",
	path: "/elections",
	async load(event) {
		await requireAuth(event);
		const all = await electionsService.getPublicCycles(
			await requestContentFilter(event),
		);
		const open = all.filter(
			(c) => c.status === "open" || c.status === "voting",
		);
		if (open.length > 0)
			throw event.redirect(302, await itemUrl("elections:cycle", open[0]));
		return { cycles: await withItemUrls("elections:cycle", open) };
	},
});

export const myApplicationsPage = definePage({
	id: "elections.mine",
	path: "/elections/mine",
	// The viewer's OWN applications: the admin's note on a rejection is addressed to them.
	allowPrivateFields: ["adminNote"],
	async load(event) {
		const user = await requireAuth(event);
		const applications = await electionsService.getApplicationsByUser(user.id);

		const byCycle = new Map<
			string,
			{ cycle: (typeof applications)[0]["cycle"]; apps: typeof applications }
		>();
		for (const app of applications) {
			const key = app.cycleId;
			if (!byCycle.has(key)) byCycle.set(key, { cycle: app.cycle, apps: [] });
			byCycle.get(key)?.apps.push(app);
		}

		const groups = [...byCycle.values()].sort(
			(a, b) => b.cycle.year - a.cycle.year,
		);
		const urls = await withItemUrls(
			"elections:cycle",
			groups.map((g) => g.cycle),
		);
		return {
			groups: groups.map((g, i) => ({ ...g, cycleUrl: urls[i].url })),
		};
	},
});

export const electionDetailPage = definePage({
	id: "elections.detail",
	path: "/elections/:id",
	async load(event, { params, scopePath }): Promise<ElectionDetailViewData> {
		const user = await requireAuth(event);
		const [cycle, approvedApps] = await Promise.all([
			electionsService.getCycleById(params.id),
			electionsService.getApprovedApplicationsByCycle(params.id),
		]);
		if (!cycle || cycle.status === "draft") {
			throw event.redirect(302, scopeUrl(scopePath, "/elections"));
		}
		const url = await itemUrl("elections:cycle", cycle);
		requireCanonicalUrl(event, url);

		let userCanApply = cycle.status === "open";
		if (userCanApply && cycle.requiredMembershipTier) {
			userCanApply = await membershipsService.hasTier(
				user.id,
				cycle.requiredMembershipTier,
			);
		}

		const userApplications = await electionsService.getApplicationsByUser(
			user.id,
		);
		const userAppPositionIds = new Set(
			userApplications
				.filter((a) => a.cycleId === cycle.id)
				.map((a) => a.positionId),
		);

		return {
			cycle,
			url,
			applyUrl: `${url}/apply`,
			approvedApps: approvedApps.map(toPublicCandidate),
			userCanApply,
			userAppPositionIds: [...userAppPositionIds],
		};
	},
});

export const electionApplyPage = definePage({
	id: "elections.apply",
	path: "/elections/:id/apply",
	async load(event, { params, scopePath }) {
		const user = await requireAuth(event);

		const cycle = await electionsService.getCycleById(params.id);
		if (!cycle) throw event.redirect(302, scopeUrl(scopePath, "/elections"));
		const cycleUrl = await itemUrl("elections:cycle", cycle);
		if (cycle.status !== "open") throw event.redirect(302, cycleUrl);
		requireCanonicalUrl(event, `${cycleUrl}/apply`);

		const positionId = event.url.searchParams.get("positionId");
		const position = positionId
			? cycle.positions.find((p) => p.id === positionId)
			: null;
		if (!position) throw event.redirect(302, cycleUrl);

		if (cycle.requiredMembershipTier) {
			const hasAccess = await membershipsService.hasTier(
				user.id,
				cycle.requiredMembershipTier,
			);
			if (!hasAccess) throw event.redirect(302, cycleUrl);
		}

		return { cycle, cycleUrl, position, userId: user.id };
	},
});

// Declared order matters: static paths before "/elections/:id".
export const electionsPages = [
	electionsListPage,
	myApplicationsPage,
	electionDetailPage,
	electionApplyPage,
];
