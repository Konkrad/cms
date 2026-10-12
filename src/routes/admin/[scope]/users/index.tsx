import { component$, useSignal } from "@qwik.dev/core";
import {
	Form,
	Link,
	routeAction$,
	routeLoader$,
	z,
	zod$,
} from "@qwik.dev/router";
import { PAGE_SIZE, Pagination } from "~/core/admin/Pagination/Pagination";
import { SearchBar } from "~/core/admin/SearchBar/SearchBar";
import { formatDate, t } from "~/core/i18n";
import { membershipsService } from "~/core/memberships/memberships.service";
import { reevaluateUserTagsForUser } from "~/core/registry/manifests";
import { adminUrl } from "~/core/router/scope-path";
import { requireSystemAdmin } from "~/core/scopes/access";
import { assertNoPrivateFields } from "~/core/shared/no-private-fields";
import { userTagsService } from "~/core/tags/user-tags.service";
import { adminUsersService } from "~/core/users/admin-users.service";

/** All users (root only; scopes below show their members on the members page). */
export const useUsers = routeLoader$(async (event) => {
	const { scope } = await requireSystemAdmin(event);
	const { url } = event;
	const search = url.searchParams.get("search")?.trim() ?? "";
	const page = Math.max(
		1,
		parseInt(url.searchParams.get("page") ?? "1", 10) || 1,
	);
	const offset = (page - 1) * PAGE_SIZE;
	const definitions = await userTagsService.getDefinitions();

	const { users, total } = await adminUsersService.listWithEmailAndRole({
		search,
		limit: PAGE_SIZE,
		offset,
	});

	return assertNoPrivateFields(
		{
			users,
			total,
			page,
			pageSize: PAGE_SIZE,
			base: adminUrl(scope.path),
			definitions,
			search,
		},
		{
			// Admin user management: admins search and contact users by email.
			allow: ["email"],
		},
	);
});

export const useSetTier = routeAction$(
	async (data, event) => {
		const { user: admin } = await requireSystemAdmin(event);
		await membershipsService.setTier(data.userId, data.tier, admin.id);
		return { success: true };
	},
	zod$({
		userId: z.string().uuid(),
		tier: z.enum(["associated", "full"]),
	}),
);

export const useRemoveMembership = routeAction$(
	async (data, event) => {
		await requireSystemAdmin(event);
		await membershipsService.removeMembership(data.userId);
		return { success: true };
	},
	zod$({ userId: z.string().uuid() }),
);

export const useGrantTag = routeAction$(
	async (data, event) => {
		const { user: admin } = await requireSystemAdmin(event);
		await userTagsService.grantFromDefinition(
			data.userId,
			data.definitionId,
			admin.id,
		);
		return { success: true };
	},
	zod$({
		userId: z.string().uuid(),
		definitionId: z.string().uuid(),
	}),
);

export const useRevokeTag = routeAction$(
	async (data, event) => {
		await requireSystemAdmin(event);
		await userTagsService.revoke(data.userId, data.slug);
		return { success: true };
	},
	zod$({ userId: z.string().uuid(), slug: z.string().min(1) }),
);

export const useReevaluateBadges = routeAction$(async (_data, event) => {
	await requireSystemAdmin(event);
	const memberships = await membershipsService.getAll();
	await Promise.all(
		memberships.map((m) => reevaluateUserTagsForUser(m.userId)),
	);
	return { success: true };
}, zod$({}));

export default component$(() => {
	const data = useUsers();
	const setTierAction = useSetTier();
	const removeAction = useRemoveMembership();
	const grantTagAction = useGrantTag();
	const revokeTagAction = useRevokeTag();
	const reevalAction = useReevaluateBadges();
	const openUserId = useSignal<string | null>(null);

	const totalPages = Math.ceil(data.value.total / data.value.pageSize);

	return (
		<div>
			<div class="flex items-center justify-between mb-6">
				<h2 class="text-2xl font-bold text-gray-800">
					{t("admin.users.allUsers")}
				</h2>
				<div class="flex items-center gap-3">
					<Link
						href={`${data.value.base}/tags`}
						class="text-sm text-gray-500 hover:text-gray-700 border border-gray-300 rounded px-3 py-1.5"
					>
						{t("admin.users.manageTags")}
					</Link>
					<Form action={reevalAction}>
						<button
							type="submit"
							class="text-sm text-blue-600 hover:text-blue-800 border border-blue-300 rounded px-3 py-1.5"
						>
							{t("admin.users.reEvaluateBadgeRules")}
						</button>
					</Form>
				</div>
			</div>

			<SearchBar
				value={data.value.search}
				placeholder={t("admin.users.searchByNameOrEmail")}
			/>

			{data.value.definitions.length === 0 && (
				<div class="mb-4 p-3 bg-amber-50 border border-amber-200 rounded text-amber-800 text-sm">
					{t("admin.users.noTagDefinitionsYet")}{" "}
					<a href={`${data.value.base}/tags`} class="underline font-medium">
						{t("admin.users.addSomeTags")}
					</a>{" "}
					{t("admin.users.beforeYouCanAssignThem")}
				</div>
			)}

			{openUserId.value && (
				<div
					class="fixed inset-0 z-10"
					onClick$={() => {
						openUserId.value = null;
					}}
				/>
			)}

			<div class="bg-white rounded-lg shadow-sm overflow-x-auto">
				<table class="min-w-full divide-y divide-gray-200">
					<thead class="bg-gray-50">
						<tr>
							<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
								{t("admin.users.name")}
							</th>
							<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
								{t("admin.users.email")}
							</th>
							<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
								{t("admin.users.location")}
							</th>
							<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
								{t("admin.users.joined")}
							</th>
							<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
								{t("admin.users.lastLogin")}
							</th>
							<th class="px-6 py-3 w-12" />
						</tr>
					</thead>
					<tbody class="bg-white divide-y divide-gray-200">
						{data.value.users.map((user) => (
							<tr key={user.id} class="hover:bg-gray-50 align-top">
								<td class="px-6 py-4 whitespace-nowrap">
									<Link
										href={`/users/${user.id}`}
										class="text-sm font-medium text-blue-600 hover:underline"
									>
										{user.name} {user.familyName}
									</Link>
									{user.platformRole && (
										<span class="ml-2 px-1.5 py-0.5 text-xs rounded bg-purple-100 text-purple-700 capitalize">
											{user.platformRole}
										</span>
									)}
								</td>
								<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
									{user.email ?? "—"}
								</td>
								<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
									{[user.city, user.country].filter(Boolean).join(", ") || "—"}
								</td>
								<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
									{formatDate(user.createdAt)}
								</td>
								<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
									{user.lastLogin ? formatDate(user.lastLogin) : "—"}
								</td>
								<td class="px-6 py-4 whitespace-nowrap text-right relative">
									<button
										type="button"
										class="p-1.5 rounded text-gray-400 hover:text-gray-700 hover:bg-gray-100 text-lg leading-none"
										onClick$={() => {
											openUserId.value =
												openUserId.value === user.id ? null : user.id;
										}}
									>
										⋮
									</button>
									{openUserId.value === user.id && (
										<div class="absolute right-4 top-12 z-20 w-64 bg-white border border-gray-200 rounded-lg shadow-lg py-1 text-left">
											<div class="px-3 py-1.5 text-xs font-semibold text-gray-400 uppercase tracking-wide">
												{t("admin.users.membership")}
											</div>
											<Form action={setTierAction}>
												<input type="hidden" name="userId" value={user.id} />
												<input type="hidden" name="tier" value="associated" />
												<button
													type="submit"
													class="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
												>
													{t("admin.users.setAssociatedMember")}
												</button>
											</Form>
											<Form action={setTierAction}>
												<input type="hidden" name="userId" value={user.id} />
												<input type="hidden" name="tier" value="full" />
												<button
													type="submit"
													class="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
												>
													{t("admin.users.setFullMember")}
												</button>
											</Form>
											{user.membership && (
												<Form action={removeAction}>
													<input type="hidden" name="userId" value={user.id} />
													<button
														type="submit"
														class="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50"
													>
														{t("admin.users.removeMembership")}
													</button>
												</Form>
											)}
											<div class="border-t border-gray-100 my-1" />
											<div class="px-3 py-1.5 text-xs font-semibold text-gray-400 uppercase tracking-wide">
												{t("admin.users.tags")}
											</div>
											{user.tags.length > 0 && (
												<div class="px-4 pb-2 flex flex-wrap gap-1">
													{user.tags.map((tag) => (
														<span
															key={tag.id}
															class="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-xs bg-indigo-50 text-indigo-700 border border-indigo-100"
														>
															{tag.label}
															{tag.sourceType === "manual" && (
																<Form action={revokeTagAction} class="inline">
																	<input
																		type="hidden"
																		name="userId"
																		value={user.id}
																	/>
																	<input
																		type="hidden"
																		name="slug"
																		value={tag.slug}
																	/>
																	<button
																		type="submit"
																		class="ml-0.5 text-indigo-400 hover:text-red-500 leading-none"
																		title={t("admin.users.revokeTag")}
																	>
																		×
																	</button>
																</Form>
															)}
														</span>
													))}
												</div>
											)}
											{data.value.definitions.length > 0 && (
												<Form
													action={grantTagAction}
													class="px-4 pb-3 flex gap-1"
												>
													<input type="hidden" name="userId" value={user.id} />
													<select
														name="definitionId"
														class="text-xs border rounded px-2 py-1 flex-1 min-w-0"
													>
														{data.value.definitions.map((def) => (
															<option key={def.id} value={def.id}>
																{def.label}
															</option>
														))}
													</select>
													<button
														type="submit"
														class="text-xs text-green-600 hover:text-green-800 border border-green-200 rounded px-2 py-1 whitespace-nowrap"
													>
														{t("admin.users.assign")}
													</button>
												</Form>
											)}
										</div>
									)}
								</td>
							</tr>
						))}
					</tbody>
				</table>
				{data.value.users.length === 0 && (
					<div class="text-center py-12 text-gray-500">
						{data.value.search
							? t("admin.users.noUsersFoundFor", { search: data.value.search })
							: t("admin.users.noUsersFound")}
					</div>
				)}
				<Pagination
					page={data.value.page}
					totalPages={totalPages}
					total={data.value.total}
					pageSize={data.value.pageSize}
				/>
			</div>
		</div>
	);
});
