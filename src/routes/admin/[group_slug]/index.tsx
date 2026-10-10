import { component$ } from "@qwik.dev/core";
import { routeLoader$ } from "@qwik.dev/router";
import { Button } from "~/components/ui/Button/Button";
import { adminDashboardService } from "~/core/admin/dashboard.service";
import { groupsService } from "~/core/scopes/groups.service";

export const useAdminStats = routeLoader$(async ({ params }) => {
	const groupSlug = params.group_slug;

	if (groupSlug === "global") {
		return {
			isGlobal: true,
			stats: { members: 0, ...(await adminDashboardService.getGlobalStats()) },
		};
	}

	const group = await groupsService.getBySlug(groupSlug);
	if (!group) {
		return {
			isGlobal: false,
			stats: { members: 0, posts: 0, events: 0, users: 0, pages: 0 },
		};
	}

	return {
		isGlobal: false,
		group,
		stats: {
			users: 0,
			pages: 0,
			...(await adminDashboardService.getGroupStats(group.id)),
		},
	};
});

export default component$(() => {
	const stats = useAdminStats();

	return (
		<div>
			<h2 class="text-2xl font-bold text-gray-900 mb-6">
				{stats.value.isGlobal ? "Platform Dashboard" : "Group Dashboard"}
			</h2>

			<div class="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
				{stats.value.isGlobal ? (
					<>
						<div class="bg-white rounded-lg shadow-sm p-6">
							<div class="text-sm text-gray-600 mb-1">Total Users</div>
							<div class="text-3xl font-bold text-gray-900">
								{stats.value.stats.users}
							</div>
						</div>
						<div class="bg-white rounded-lg shadow-sm p-6">
							<div class="text-sm text-gray-600 mb-1">Total Posts</div>
							<div class="text-3xl font-bold text-blue-600">
								{stats.value.stats.posts}
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
							<div class="text-sm text-gray-600 mb-1">Group Posts</div>
							<div class="text-3xl font-bold text-blue-600">
								{stats.value.stats.posts}
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
					<Button
						href={`/admin/${stats.value.isGlobal ? "global" : stats.value.group?.slug}/events/new`}
						variant="secondary"
					>
						+ New Event
					</Button>
					<Button
						href={`/admin/${stats.value.isGlobal ? "global" : stats.value.group?.slug}/posts/new`}
						variant="secondary"
					>
						+ New Post
					</Button>
					{stats.value.isGlobal && (
						<Button href="/admin/global/pages/new" variant="secondary">
							+ New Page
						</Button>
					)}
					<Button
						href={`/admin/${stats.value.isGlobal ? "global" : stats.value.group?.slug}/users`}
						variant="secondary"
					>
						View {stats.value.isGlobal ? "Users" : "Members"}
					</Button>
					{stats.value.isGlobal && (
						<Button href="/admin/global/groups" variant="secondary">
							Manage Groups
						</Button>
					)}
				</div>
			</div>
		</div>
	);
});
