import { component$ } from "@qwik.dev/core";
import { routeLoader$ } from "@qwik.dev/router";
import { format } from "date-fns";
import { usersService } from "~/services/users.service";
import { groupsService } from "~/services/groups.service";
import { db } from "~/db/connection";
import { groupMemberships } from "~/db/schemas/group-memberships";
import { logins } from "~/db/schemas/logins";
import { users } from "~/db/schemas/users";
import { eq } from "drizzle-orm";

export const useUsers = routeLoader$(async ({ params }) => {
  const groupSlug = params.group_slug;

  // For global admin, show all users with membership info
  if (groupSlug === "global") {
    const [usersRes, memberships, allTags, definitions] = await Promise.all([
      usersService.getAll(1000),
      membershipsService.getAll(),
      userTagsService.getAll(),
      userTagsService.getDefinitions(),
    ]);

    // Fetch emails from logins table
    const loginIds = usersRes.items
      .map((u) => u.loginId)
      .filter(Boolean) as string[];
    const loginRows = loginIds.length
      ? await db.select({ id: logins.id, email: logins.email }).from(logins)
      : [];
    const emailMap = new Map(loginRows.map((l) => [l.id, l.email]));

    const membershipMap = new Map(memberships.map((m) => [m.userId, m]));
    const tagsByUser = new Map<string, typeof allTags>();
    for (const tag of allTags) {
      if (!tagsByUser.has(tag.userId)) tagsByUser.set(tag.userId, []);
      tagsByUser.get(tag.userId)!.push(tag);
    }

    const usersWithDetails = usersRes.items.map((u) => ({
      ...u,
      email: u.loginId ? (emailMap.get(u.loginId) ?? null) : null,
      membership: membershipMap.get(u.id) ?? null,
      tags: tagsByUser.get(u.id) ?? [],
    }));

    return { users: usersWithDetails, groupSlug, isGlobal: true, definitions };
  }

  // For group representatives, show only group members
  const group = await groupsService.getBySlug(groupSlug);
  if (!group) {
    return { users: [], groupSlug, isGlobal: false };
  }

  // Get all members of this group with user details, email, and membership info
  const members = await db
    .select({
      id: users.id,
      name: users.name,
      familyName: users.familyName,
      email: logins.email,
      role: users.role,
      city: users.city,
      country: users.country,
      createdAt: users.createdAt,
      joinedAt: groupMemberships.joinedAt,
      membershipTier: groupMemberships.tier,
    })
    .from(groupMemberships)
    .innerJoin(users, eq(groupMemberships.userId, users.id))
    .leftJoin(logins, eq(users.loginId, logins.id))
    .where(eq(groupMemberships.groupId, group.id))
    .orderBy(groupMemberships.joinedAt);

  return { users: members, groupSlug, isGlobal: false };
});

export const useSetTier = routeAction$(
  async (data, event) => {
    const { requireAdmin } = await import("~/utils/server-auth");
    const admin = await requireAdmin(event);
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
    const { requireAdmin } = await import("~/utils/server-auth");
    await requireAdmin(event);
    await membershipsService.removeMembership(data.userId);
    return { success: true };
  },
  zod$({ userId: z.string().uuid() }),
);

export const useGrantTag = routeAction$(
  async (data, event) => {
    const { requireAdmin } = await import("~/utils/server-auth");
    const admin = await requireAdmin(event);
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
    const { requireAdmin } = await import("~/utils/server-auth");
    await requireAdmin(event);
    await userTagsService.revoke(data.userId, data.slug);
    return { success: true };
  },
  zod$({ userId: z.string().uuid(), slug: z.string().min(1) }),
);

export const useReevaluateBadges = routeAction$(async (_data, event) => {
  const { requireAdmin } = await import("~/utils/server-auth");
  await requireAdmin(event);
  const memberships = await membershipsService.getAll();
  await Promise.all(
    memberships.map((m) => userTagsService.evaluateRulesForUser(m.userId)),
  );
  return { success: true };
}, zod$({}));

const tierBadge = (tier: string | null) => {
  if (!tier) return <span class="text-gray-400 text-xs">None</span>;
  const cls =
    tier === "full" ? "bg-blue-100 text-blue-800" : "bg-gray-100 text-gray-700";
  return (
    <span
      class={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${cls}`}
    >
      {tier}
    </span>
  );
};

export default component$(() => {
  const data = useUsers();
  const setTierAction = useSetTier();
  const removeAction = useRemoveMembership();
  const grantTagAction = useGrantTag();
  const revokeTagAction = useRevokeTag();
  const reevalAction = useReevaluateBadges();

  return (
    <div>
      <div class="flex items-center justify-between mb-6">
        <h2 class="text-2xl font-bold text-gray-800">
          {data.value.isGlobal ? "All Users" : "Group Members"}
        </h2>
        {data.value.isGlobal && (
          <div class="flex items-center gap-3">
            <Link
              href="/admin/global/tags"
              class="text-sm text-gray-500 hover:text-gray-700 border border-gray-300 rounded px-3 py-1.5"
            >
              Manage tags →
            </Link>
            <Form action={reevalAction} method="POST">
              <button
                type="submit"
                class="text-sm text-blue-600 hover:text-blue-800 border border-blue-300 rounded px-3 py-1.5"
              >
                Re-evaluate badge rules
              </button>
            </Form>
          </div>
        )}
      </div>

      {data.value.isGlobal && data.value.definitions.length === 0 && (
        <div class="mb-4 p-3 bg-amber-50 border border-amber-200 rounded text-amber-800 text-sm">
          No tag definitions yet.{" "}
          <a href="/admin/global/tags" class="underline font-medium">
            Add some tags
          </a>{" "}
          before you can assign them to members.
        </div>
      )}

      <div class="bg-white rounded-lg shadow-sm overflow-hidden">
        <table class="min-w-full divide-y divide-gray-200">
          <thead class="bg-gray-50">
            <tr>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Name
              </th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Email
              </th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Role
              </th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Location
              </th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                {data.value.isGlobal ? "Joined" : "Member Since"}
              </th>
              {data.value.isGlobal && (
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Membership
                </th>
              )}
              {data.value.isGlobal && (
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Set Tier
                </th>
              )}
              {data.value.isGlobal && (
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Tags
                </th>
              )}
            </tr>
          </thead>
          <tbody class="bg-white divide-y divide-gray-200">
            {data.value.users.map((user) => (
              <tr key={user.id} class="hover:bg-gray-50 align-top">
                <td class="px-6 py-4 whitespace-nowrap">
                  <div class="text-sm font-medium text-gray-900">
                    {user.name} {user.familyName}
                  </div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                  <div class="text-sm text-gray-900">{user.email ?? ""}</div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                  <span
                    class={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                      user.role === "admin"
                        ? "bg-purple-100 text-purple-800"
                        : "bg-green-100 text-green-800"
                    }`}
                  >
                    {user.role}
                  </span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {user.city && user.country
                    ? `${user.city}, ${user.country}`
                    : "-"}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {format(
                    new Date(
                      data.value.isGlobal
                        ? user.createdAt
                        : (user as any).joinedAt,
                    ),
                    "MMM d, yyyy",
                  )}
                </td>
                {data.value.isGlobal && (
                  <td class="px-6 py-4">
                    {tierBadge(user.membership?.tier ?? null)}
                    {user.membership && (
                      <Form
                        action={removeAction}
                        method="POST"
                        class="inline ml-2"
                      >
                        <input type="hidden" name="userId" value={user.id} />
                        <button
                          type="submit"
                          preventdefault:click
                          class="text-xs text-red-500 hover:text-red-700"
                          onClick$={(e) => {
                            if (!confirm("Remove membership?")) return;
                            (e.target as HTMLElement)
                              .closest("form")
                              ?.requestSubmit();
                          }}
                        >
                          Remove
                        </button>
                      </Form>
                    )}
                  </td>
                )}
                {data.value.isGlobal && (
                  <td class="px-6 py-4">
                    <Form
                      action={setTierAction}
                      method="POST"
                      class="flex items-center gap-2"
                    >
                      <input type="hidden" name="userId" value={user.id} />
                      <select
                        name="tier"
                        class="text-xs border rounded px-2 py-1"
                      >
                        <option value="associated">Associated</option>
                        <option value="full">Full</option>
                      </select>
                      <button
                        type="submit"
                        class="text-xs text-blue-600 hover:text-blue-800"
                      >
                        Set
                      </button>
                    </Form>
                  </td>
                )}
                {data.value.isGlobal && (
                  <td class="px-6 py-4">
                    {/* Existing tags */}
                    {user.tags.length > 0 && (
                      <div class="flex flex-wrap gap-1 mb-2">
                        {user.tags.map((tag) => (
                          <span
                            key={tag.id}
                            class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-indigo-50 text-indigo-700 border border-indigo-100"
                          >
                            {tag.label}
                            {tag.sourceType === "manual" && (
                              <Form
                                action={revokeTagAction}
                                method="POST"
                                class="inline"
                              >
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
                                  preventdefault:click
                                  class="ml-0.5 text-indigo-400 hover:text-red-500 leading-none"
                                  title="Revoke tag"
                                  onClick$={(e) => {
                                    if (
                                      !confirm(
                                        `Revoke "${tag.label}" from this user?`,
                                      )
                                    )
                                      return;
                                    (e.target as HTMLElement)
                                      .closest("form")
                                      ?.requestSubmit();
                                  }}
                                >
                                  ×
                                </button>
                              </Form>
                            )}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Assign from dropdown */}
                    {data.value.definitions.length > 0 && (
                      <Form
                        action={grantTagAction}
                        method="POST"
                        class="flex items-center gap-1"
                      >
                        <input type="hidden" name="userId" value={user.id} />
                        <select
                          name="definitionId"
                          class="text-xs border rounded px-2 py-1 max-w-[160px]"
                        >
                          {data.value.definitions.map((def) => (
                            <option key={def.id} value={def.id}>
                              {def.label}
                            </option>
                          ))}
                        </select>
                        <button
                          type="submit"
                          class="text-xs text-green-600 hover:text-green-800 whitespace-nowrap"
                        >
                          Assign
                        </button>
                      </Form>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        {data.value.users.length === 0 && (
          <div class="text-center py-12 text-gray-500">
            {data.value.isGlobal
              ? "No users found."
              : "No members in this group yet."}
          </div>
        )}
      </div>
    </div>
  );
});
