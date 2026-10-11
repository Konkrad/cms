import { component$ } from "@qwik.dev/core";
import { routeLoader$ } from "@qwik.dev/router";
import { Button } from "~/components/ui/Button/Button";
import { adminDashboardService } from "~/core/admin/dashboard.service";
import { adminUrl } from "~/core/router/scope-path";
import { ADMIN_ACCESS, requireScopeRole } from "~/core/scopes/access";
import { assertNoPrivateFields } from "~/core/shared/no-private-fields";

export const useAdminStats = routeLoader$(async (event) => {
	const { scope } = await requireScopeRole(event, ADMIN_ACCESS);
	const isRoot = scope.parentId === null;
	const base = adminUrl(scope.path);
	if (isRoot) {
		return assertNoPrivateFields({
			isRoot,
			base,
			stats: { members: 0, ...(await adminDashboardService.getGlobalStats()) },
		});
	}
	return assertNoPrivateFields({
		isRoot,
		base,
		stats: {
			users: 0,
			pages: 0,
			...(await adminDashboardService.getScopeStats(scope.id)),
		},
	});
});

export default component$(() => {
	const stats = useAdminStats();

	return (
		<div>
			<h2 class="text-2xl font-bold text-gray-900 mb-6">
				{stats.value.isRoot ? "Platform Dashboard" : "Group Dashboard"}
			</h2>

			<div class="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
				{stats.value.isRoot ? (
					<>
						<div class="bg-white rounded-lg shadow-sm p-6">
							<div class="text-sm text-gray-600 mb-1">Total Users</div>
							<div class="text-3xl font-bold text-gray-900">
								{stats.value.stats.users}
							</div>
						</div>
						<div class="bg-white rounded-lg shadow-sm p-6">
							<div class="text-sm text-gray-600 mb-1">Notes · Articles</div>
							<div class="text-3xl font-bold text-blue-600">
								{stats.value.stats.notes} · {stats.value.stats.articles}
							</div>
						</div>
						<div class="bg-white rounded-lg shadow-sm p-6">
							<div class="text-sm text-gray-600 mb-1">Total Events</div>
							<div class="text-3xl font-bold text-green-600">
								{stats.value.stats.events}
							</div>
						</div>
						<div class="bg-white rounded-lg shadow-sm p-6">
							<div class="text-sm text-gray-600 mb-1">Total Pages</div>
							<div class="text-3xl font-bold text-slate-600">
								{stats.value.stats.pages}
							</div>
						</div>
					</>
				) : (
					<>
						<div class="bg-white rounded-lg shadow-sm p-6">
							<div class="text-sm text-gray-600 mb-1">Members</div>
							<div class="text-3xl font-bold text-gray-900">
								{stats.value.stats.members}
							</div>
						</div>
						<div class="bg-white rounded-lg shadow-sm p-6">
							<div class="text-sm text-gray-600 mb-1">Notes · Articles</div>
							<div class="text-3xl font-bold text-blue-600">
								{stats.value.stats.notes} · {stats.value.stats.articles}
							</div>
						</div>
						<div class="bg-white rounded-lg shadow-sm p-6">
							<div class="text-sm text-gray-600 mb-1">Group Events</div>
							<div class="text-3xl font-bold text-green-600">
								{stats.value.stats.events}
							</div>
						</div>
					</>
				)}
			</div>

			<div class="bg-white rounded-lg shadow-sm p-6">
				<h3 class="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
				<div class="grid grid-cols-2 md:grid-cols-4 gap-4">
					<Button href={`${stats.value.base}/events/new`} variant="secondary">
						+ New Event
					</Button>
					<Button href={`${stats.value.base}/notes`} variant="secondary">
						+ New Note
					</Button>
					<Button href={`${stats.value.base}/articles/new`} variant="secondary">
						+ New Article
					</Button>
					{stats.value.isRoot && (
						<Button href={`${stats.value.base}/pages/new`} variant="secondary">
							+ New Page
						</Button>
					)}
					<Button
						href={`${stats.value.base}/${stats.value.isRoot ? "users" : "members"}`}
						variant="secondary"
					>
						View {stats.value.isRoot ? "Users" : "Members"}
					</Button>
					<Button href={`${stats.value.base}/scope`} variant="secondary">
						Manage Groups
					</Button>
				</div>
			</div>
		</div>
	);
});
