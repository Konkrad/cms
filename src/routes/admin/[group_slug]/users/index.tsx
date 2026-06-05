import { component$, useSignal } from "@qwik.dev/core";
import { Form, Link, routeAction$, routeLoader$, z, zod$ } from "@qwik.dev/router";
import { format } from "date-fns";
import { membershipsService } from "~/services/memberships.service";
import { userTagsService } from "~/services/user-tags.service";
import { groupsService } from "~/services/groups.service";
import { db } from "~/db/connection";
import { groupMemberships } from "~/db/schemas/group-memberships";
import { userMemberships } from "~/db/schemas/user-memberships";
import { logins } from "~/db/schemas/logins";
import { users } from "~/db/schemas/users";
import { sessions } from "~/db/schemas/sessions";
import { and, desc, eq, inArray, like, or, sql } from "drizzle-orm";
import { Pagination, PAGE_SIZE } from "~/components/admin/Pagination/Pagination";
import { SearchBar } from "~/components/admin/SearchBar/SearchBar";

export const useUsers = routeLoader$(async ({ params, url }) => {
  const groupSlug = params.group_slug;
  const search = url.searchParams.get("search")?.trim() ?? "";
  const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1") || 1);
  const offset = (page - 1) * PAGE_SIZE;

  const searchWhere = search
    ? or(
        like(users.name, `%${search}%`),
        like(users.familyName, `%${search}%`),
        like(logins.email, `%${search}%`),
      )
    : undefined;

  if (groupSlug === "global") {
    const [countRows, paginatedRows, definitions] = await Promise.all([
      db
        .select({ total: sql<number>`COUNT(DISTINCT ${users.id})` })
        .from(users)
        .leftJoin(logins, eq(users.loginId, logins.id))
        .where(searchWhere),
      db
        .select({
          id: users.id,
          name: users.name,
          familyName: users.familyName,
          loginId: users.loginId,
          email: logins.email,
          role: users.role,
          city: users.city,
          country: users.country,
          createdAt: users.createdAt,
        })
        .from(users)
        .leftJoin(logins, eq(users.loginId, logins.id))
        .where(searchWhere)
        .orderBy(desc(users.createdAt))
        .limit(PAGE_SIZE)
        .offset(offset),
      userTagsService.getDefinitions(),
    ]);

    const total = Number(countRows[0]?.total ?? 0);
    const userIds = paginatedRows.map((u) => u.id);

    const [membershipRows, allTags, lastLoginRows] = userIds.length
      ? await Promise.all([
          db
            .select()
            .from(userMemberships)
            .where(inArray(userMemberships.userId, userIds)),
          userTagsService.getAll(),
          db
            .select({
              userId: sessions.userId,
              lastLogin: sql<string>`MAX(${sessions.createdAt})`,
            })
            .from(sessions)
            .where(inArray(sessions.userId, userIds))
            .groupBy(sessions.userId),
        ])
      : [[], [], []];

    const membershipMap = new Map(membershipRows.map((m) => [m.userId, m]));
    const tagsByUser = new Map<string, typeof allTags>();
    for (const tag of allTags) {
      if (userIds.includes(tag.userId)) {
        if (!tagsByUser.has(tag.userId)) tagsByUser.set(tag.userId, []);
        tagsByUser.get(tag.userId)!.push(tag);
      }
    }
    const lastLoginMap = new Map(
      lastLoginRows.map((r) => [r.userId, r.lastLogin]),
    );

    const usersWithDetails = paginatedRows.map((u) => ({
      ...u,
      joinedAt: u.createdAt,
      membership: membershipMap.get(u.id) ?? null,
      tags: tagsByUser.get(u.id) ?? [],
      lastLogin: lastLoginMap.get(u.id) ?? null,
    }));

    return {
      users: usersWithDetails,
      total,
      page,
      pageSize: PAGE_SIZE,
      groupSlug,
      isGlobal: true,
      definitions,
      search,
    };
  }

  // Group-specific view
  const group = await groupsService.getBySlug(groupSlug);
  if (!group) {
    const definitions = await userTagsService.getDefinitions();
    return {
      users: [],
      total: 0,
      page,
      pageSize: PAGE_SIZE,
      groupSlug,
      isGlobal: false,
      definitions,
      search,
    };
  }

  const baseWhere = eq(groupMemberships.groupId, group.id);
  const where = search
    ? and(
        baseWhere,
        or(
          like(users.name, `%${search}%`),
          like(users.familyName, `%${search}%`),
          like(logins.email, `%${search}%`),
        ),
      )
    : baseWhere;

  const [countRows, memberRows, definitions] = await Promise.all([
    db
      .select({ total: sql<number>`COUNT(*)` })
      .from(groupMemberships)
      .innerJoin(users, eq(groupMemberships.userId, users.id))
      .leftJoin(logins, eq(users.loginId, logins.id))
      .where(where),
    db
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
      })
      .from(groupMemberships)
      .innerJoin(users, eq(groupMemberships.userId, users.id))
      .leftJoin(logins, eq(users.loginId, logins.id))
      .where(where)
      .orderBy(groupMemberships.joinedAt)
      .limit(PAGE_SIZE)
      .offset(offset),
    userTagsService.getDefinitions(),
  ]);

  const total = Number(countRows[0]?.total ?? 0);
  const userIds = memberRows.map((m) => m.id);

  const [membershipRows, allTags, lastLoginRows] = userIds.length
    ? await Promise.all([
        db
          .select()
          .from(userMemberships)
          .where(inArray(userMemberships.userId, userIds)),
        userTagsService.getAll(),
        db
          .select({
            userId: sessions.userId,
            lastLogin: sql<string>`MAX(${sessions.createdAt})`,
          })
          .from(sessions)
          .where(inArray(sessions.userId, userIds))
          .groupBy(sessions.userId),
      ])
    : [[], [], []];

  const membershipMap = new Map(membershipRows.map((m) => [m.userId, m]));
  const tagsByUser = new Map<string, typeof allTags>();
  for (const tag of allTags) {
    if (userIds.includes(tag.userId)) {
      if (!tagsByUser.has(tag.userId)) tagsByUser.set(tag.userId, []);
      tagsByUser.get(tag.userId)!.push(tag);
    }
  }
  const lastLoginMap = new Map(
    lastLoginRows.map((r) => [r.userId, r.lastLogin]),
  );

  const membersWithDetails = memberRows.map((m) => ({
    ...m,
    membership: membershipMap.get(m.id) ?? null,
    tags: tagsByUser.get(m.id) ?? [],
    lastLogin: lastLoginMap.get(m.id) ?? null,
  }));

  return {
    users: membersWithDetails,
    total,
    page,
    pageSize: PAGE_SIZE,
    groupSlug,
    isGlobal: false,
    definitions,
    search,
  };
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
  if (!tier) return <span class="text-gray-400 text-xs">—</span>;
  const cls =
    tier === "full"
      ? "bg-blue-100 text-blue-800"
      : "bg-gray-100 text-gray-700";
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
  const openUserId = useSignal<string | null>(null);

  const totalPages = Math.ceil(data.value.total / data.value.pageSize);

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
            <Form action={reevalAction}>
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

      <SearchBar value={data.value.search} placeholder="Search by name or email…" />

      {data.value.isGlobal && data.value.definitions.length === 0 && (
        <div class="mb-4 p-3 bg-amber-50 border border-amber-200 rounded text-amber-800 text-sm">
          No tag definitions yet.{" "}
          <a href="/admin/global/tags" class="underline font-medium">
            Add some tags
          </a>{" "}
          before you can assign them to members.
        </div>
      )}

      {openUserId.value && (
        <div
          class="fixed inset-0 z-10"
          onClick$={() => (openUserId.value = null)}
        />
      )}

      <div class="bg-white rounded-lg shadow-sm overflow-hidden">
        <table class="min-w-full divide-y divide-gray-200">
          <thead class="bg-gray-50">
            <tr>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Name
              </th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Email
              </th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Location
              </th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                {data.value.isGlobal ? "Joined" : "Member Since"}
              </th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Last Login
              </th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Tier
              </th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Tags
              </th>
              <th class="px-6 py-3 w-12" />
            </tr>
          </thead>
          <tbody class="bg-white divide-y divide-gray-200">
            {data.value.users.map((user) => (
              <tr key={user.id} class="hover:bg-gray-50 align-top">
                <td class="px-6 py-4 whitespace-nowrap">
                  <Link
                    href={`/admin/${data.value.groupSlug}/users/${user.id}`}
                    class="text-sm font-medium text-blue-600 hover:underline"
                  >
                    {user.name} {user.familyName}
                  </Link>
                  {user.role !== "user" && (
                    <span class="ml-2 px-1.5 py-0.5 text-xs rounded bg-purple-100 text-purple-700 capitalize">
                      {user.role}
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
                  {format(
                    new Date(
                      data.value.isGlobal
                        ? user.createdAt
                        : (user as any).joinedAt,
                    ),
                    "MMM d, yyyy",
                  )}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {user.lastLogin
                    ? format(new Date(user.lastLogin), "MMM d, yyyy")
                    : "—"}
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                  {tierBadge(user.membership?.tier ?? null)}
                </td>
                <td class="px-6 py-4">
                  <div class="flex flex-wrap gap-1">
                    {user.tags.map((tag) => (
                      <span
                        key={tag.id}
                        class="px-2 py-0.5 rounded-full text-xs bg-indigo-50 text-indigo-700 border border-indigo-100 whitespace-nowrap"
                      >
                        {tag.label}
                      </span>
                    ))}
                  </div>
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
                        Membership
                      </div>
                      <Form action={setTierAction}>
                        <input type="hidden" name="userId" value={user.id} />
                        <input type="hidden" name="tier" value="associated" />
                        <button
                          type="submit"
                          class="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                        >
                          Set: Associated member
                        </button>
                      </Form>
                      <Form action={setTierAction}>
                        <input type="hidden" name="userId" value={user.id} />
                        <input type="hidden" name="tier" value="full" />
                        <button
                          type="submit"
                          class="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                        >
                          Set: Full member
                        </button>
                      </Form>
                      {user.membership && (
                        <Form action={removeAction}>
                          <input type="hidden" name="userId" value={user.id} />
                          <button
                            type="submit"
                            class="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                          >
                            Remove membership
                          </button>
                        </Form>
                      )}
                      <div class="border-t border-gray-100 my-1" />
                      <div class="px-3 py-1.5 text-xs font-semibold text-gray-400 uppercase tracking-wide">
                        Tags
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
                                    title="Revoke tag"
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
                            Assign
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
              ? `No users found for "${data.value.search}".`
              : data.value.isGlobal
                ? "No users found."
                : "No members in this group yet."}
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
