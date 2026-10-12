import { component$ } from "@qwik.dev/core";
import {
	Form,
	Link,
	routeAction$,
	routeLoader$,
	z,
	zod$,
} from "@qwik.dev/router";
import { formatDate } from "~/core/i18n";
import { adminUrl } from "~/core/router/scope-path";
import {
	ADMIN_ACCESS,
	canGrantRole,
	canManageScope,
	listMembers,
	requireScopeRole,
} from "~/core/scopes/access";
import { SCOPE_ROLES } from "~/core/scopes/schema/scopes";
import { scopesService } from "~/core/scopes/scopes.service";
import { assertNoPrivateFields } from "~/core/shared/no-private-fields";
import { buildProfileUrl } from "~/core/users/format";
import { usersService } from "~/core/users/users.service";

/**
 * Members and roles of the URL's scope. Public profiles only (no emails): representatives
 * have no users view, they see the members of their own scopes here.
 */
export const useScopeMembers = routeLoader$(async (event) => {
	const { user, scope } = await requireScopeRole(event, ADMIN_ACCESS);
	const includeBelow = event.url.searchParams.get("below") === "1";
	const query = event.url.searchParams.get("q")?.trim() ?? "";
	const [members, roleHolders, isAdminHere, found] = await Promise.all([
		listMembers(scope.id, { includeDescendants: includeBelow }),
		scopesService.listRoleHolders(scope.id),
		canManageScope(user, scope.id, "admin"),
		query.length >= 2 ? usersService.searchPublic(query, 10) : [],
	]);
	const card = (u: { id: string; name: string; familyName: string }) => ({
		id: u.id,
		name: `${u.name} ${u.familyName}`.trim(),
		profileUrl: buildProfileUrl(u),
	});
	return assertNoPrivateFields({
		base: adminUrl(scope.path),
		scopeName: scope.name,
		includeBelow,
		query,
		currentUserId: user.id,
		members: members.map((m) => ({ ...card(m), joinedAt: m.joinedAt })),
		roleHolders: roleHolders.map((r) => ({ ...card(r), role: r.role })),
		searchResults: found.map(card),
		// Admins and moderators grant every role; representatives only "representative".
		grantableRoles: isAdminHere ? [...SCOPE_ROLES] : ["representative"],
	});
});

const userSchema = { userId: z.string().uuid() };

/** The target user must exist; returns false otherwise. */
const userExists = async (id: string) =>
	!!(await usersService.getPublicProfile(id));

export const useAddMember = routeAction$(async (data, event) => {
	const { scope } = await requireScopeRole(event, ADMIN_ACCESS);
	if (scope.parentId === null)
		return event.fail(400, { message: "Everyone belongs to the root." });
	if (!(await userExists(data.userId)))
		return event.fail(404, { message: "User not found" });
	await scopesService.join(data.userId, scope.id);
	return { success: true };
}, zod$(userSchema));

export const useRemoveMember = routeAction$(async (data, event) => {
	const { scope } = await requireScopeRole(event, ADMIN_ACCESS);
	await scopesService.leave(data.userId, scope.id);
	return { success: true };
}, zod$(userSchema));

const roleSchema = { ...userSchema, role: z.enum(SCOPE_ROLES) };

export const useGrantRole = routeAction$(async (data, event) => {
	const { user, scope } = await requireScopeRole(event, ADMIN_ACCESS);
	if (!(await canGrantRole(user, scope.id, data.role)))
		throw event.error(403, "Forbidden");
	if (!(await userExists(data.userId)))
		return event.fail(404, { message: "User not found" });
	await scopesService.grantRole(data.userId, scope.id, data.role);
	return { success: true };
}, zod$(roleSchema));

export const useRevokeRole = routeAction$(async (data, event) => {
	const { user, scope } = await requireScopeRole(event, ADMIN_ACCESS);
	if (!(await canGrantRole(user, scope.id, data.role)))
		throw event.error(403, "Forbidden");
	// Nobody removes their own role (a root admin could lock everyone out).
	if (data.userId === user.id)
		return event.fail(400, { message: "You cannot revoke your own role." });
	await scopesService.revokeRole(data.userId, scope.id, data.role);
	return { success: true };
}, zod$(roleSchema));

export default component$(() => {
	const data = useScopeMembers();
	const addMember = useAddMember();
	const removeMember = useRemoveMember();
	const grant = useGrantRole();
	const revoke = useRevokeRole();
	const membersUrl = `${data.value.base}/members`;
	const errors = [addMember, removeMember, grant, revoke]
		.map((a) => {
			const v = a.value as { failed?: boolean; message?: string } | undefined;
			return v?.failed ? (v.message ?? "Invalid input") : null;
		})
		.filter(Boolean);

	return (
		<div class="space-y-8">
			<h2 class="text-2xl font-bold text-gray-800">
				Members of {data.value.scopeName}
			</h2>
			{errors.map((e) => (
				<p key={e} class="text-sm text-red-600" role="alert">
					{e}
				</p>
			))}

			<section class="bg-white rounded-lg shadow-sm p-6 space-y-4">
				<h3 class="text-lg font-semibold text-gray-900">Roles</h3>
				{data.value.roleHolders.length === 0 ? (
					<p class="text-sm text-gray-500">
						Nobody holds a role on this group directly.
					</p>
				) : (
					<ul class="divide-y divide-gray-100" data-testid="role-holders">
						{data.value.roleHolders.map((r) => (
							<li
								key={`${r.id}-${r.role}`}
								class="flex items-center justify-between py-2 text-sm"
							>
								<span>
									<a href={r.profileUrl} class="font-medium hover:underline">
										{r.name}
									</a>{" "}
									<span class="ml-2 rounded bg-purple-100 px-1.5 py-0.5 text-xs text-purple-700">
										{r.role}
									</span>
								</span>
								{r.id !== data.value.currentUserId &&
									data.value.grantableRoles.includes(r.role) && (
										<Form action={revoke}>
											<input type="hidden" name="userId" value={r.id} />
											<input type="hidden" name="role" value={r.role} />
											<button
												type="submit"
												class="text-red-600 hover:underline"
											>
												Revoke
											</button>
										</Form>
									)}
							</li>
						))}
					</ul>
				)}
			</section>

			<section class="bg-white rounded-lg shadow-sm p-6 space-y-4">
				<h3 class="text-lg font-semibold text-gray-900">Add people</h3>
				<form method="get" action={membersUrl} class="flex gap-2">
					<label for="member-search" class="sr-only">
						Search users by name
					</label>
					<input
						id="member-search"
						type="search"
						name="q"
						value={data.value.query}
						placeholder="Search users by name…"
						class="flex-1 rounded border border-gray-300 px-3 py-2 text-sm"
					/>
					<button
						type="submit"
						class="rounded border border-gray-300 px-3 py-2 text-sm"
					>
						Search
					</button>
				</form>
				{data.value.query && data.value.searchResults.length === 0 && (
					<p class="text-sm text-gray-500">No users found.</p>
				)}
				<ul class="divide-y divide-gray-100" data-testid="search-results">
					{data.value.searchResults.map((u) => (
						<li
							key={u.id}
							class="flex flex-wrap items-center justify-between gap-2 py-2 text-sm"
						>
							<span class="font-medium">{u.name}</span>
							<span class="flex items-center gap-3">
								<Form action={addMember}>
									<input type="hidden" name="userId" value={u.id} />
									<button type="submit" class="text-blue-600 hover:underline">
										Add as member
									</button>
								</Form>
								<Form action={grant} class="flex items-center gap-1">
									<input type="hidden" name="userId" value={u.id} />
									<label for={`role-${u.id}`} class="sr-only">
										Role
									</label>
									<select
										id={`role-${u.id}`}
										name="role"
										class="rounded border border-gray-300 px-2 py-1 text-xs"
									>
										{data.value.grantableRoles.map((role) => (
											<option key={role} value={role}>
												{role}
											</option>
										))}
									</select>
									<button type="submit" class="text-green-700 hover:underline">
										Grant role
									</button>
								</Form>
							</span>
						</li>
					))}
				</ul>
			</section>

			<section class="bg-white rounded-lg shadow-sm p-6 space-y-4">
				<div class="flex items-center justify-between">
					<h3 class="text-lg font-semibold text-gray-900">
						Members ({data.value.members.length})
					</h3>
					<Link
						href={
							data.value.includeBelow ? membersUrl : `${membersUrl}?below=1`
						}
						class="text-sm text-blue-600 hover:underline"
					>
						{data.value.includeBelow
							? "Only this group"
							: "Include the groups below"}
					</Link>
				</div>
				{data.value.members.length === 0 ? (
					<p class="text-sm text-gray-500">No members yet.</p>
				) : (
					<ul class="divide-y divide-gray-100" data-testid="members">
						{data.value.members.map((m) => (
							<li
								key={m.id}
								class="flex items-center justify-between py-2 text-sm"
							>
								<a href={m.profileUrl} class="font-medium hover:underline">
									{m.name}
								</a>
								<span class="flex items-center gap-4 text-gray-500">
									{formatDate(m.joinedAt)}
									{!data.value.includeBelow && (
										<Form action={removeMember}>
											<input type="hidden" name="userId" value={m.id} />
											<button
												type="submit"
												class="text-red-600 hover:underline"
											>
												Remove
											</button>
										</Form>
									)}
								</span>
							</li>
						))}
					</ul>
				)}
			</section>
		</div>
	);
});
