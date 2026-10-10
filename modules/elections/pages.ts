import { definePage, membershipsService, requireAuth } from "~/core-api";
import { toPublicCandidate } from "./public-election";
import { electionsService } from "./service";

export const electionsListPage = definePage({
	id: "elections.list",
	path: "/elections",
	async load(event) {
		await requireAuth(event);
		const all = await electionsService.getPublicCycles();
		const open = all.filter(
			(c) => c.status === "open" || c.status === "voting",
		);
		if (open.length > 0) throw event.redirect(302, `/elections/${open[0].id}`);
		return { cycles: open };
	},
});

export const myApplicationsPage = definePage({
	id: "elections.mine",
	path: "/elections/mine",
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

		return {
			groups: [...byCycle.values()].sort((a, b) => b.cycle.year - a.cycle.year),
		};
	},
});

export const electionDetailPage = definePage({
	id: "elections.detail",
	path: "/elections/:id",
	async load(event, { params }) {
		const user = await requireAuth(event);
		const [cycle, approvedApps] = await Promise.all([
			electionsService.getCycleById(params.id),
			electionsService.getApprovedApplicationsByCycle(params.id),
		]);
		if (!cycle || cycle.status === "draft") {
			throw event.redirect(302, "/elections");
		}

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
			approvedApps: approvedApps.map(toPublicCandidate),
			userCanApply,
			userAppPositionIds: [...userAppPositionIds],
		};
	},
});

export const electionApplyPage = definePage({
	id: "elections.apply",
	path: "/elections/:id/apply",
	async load(event, { params }) {
		const user = await requireAuth(event);

		const cycle = await electionsService.getCycleById(params.id);
		if (!cycle || cycle.status !== "open") {
			throw event.redirect(302, `/elections/${params.id}`);
		}

		const positionId = event.url.searchParams.get("positionId");
		const position = positionId
			? cycle.positions.find((p) => p.id === positionId)
			: null;
		if (!position) throw event.redirect(302, `/elections/${params.id}`);

		if (cycle.requiredMembershipTier) {
			const hasAccess = await membershipsService.hasTier(
				user.id,
				cycle.requiredMembershipTier,
			);
			if (!hasAccess) throw event.redirect(302, `/elections/${params.id}`);
		}

		return { cycle, position, userId: user.id };
	},
});

// Declared order matters: static paths before "/elections/:id".
export const electionsPages = [
	electionsListPage,
	myApplicationsPage,
	electionDetailPage,
	electionApplyPage,
];
