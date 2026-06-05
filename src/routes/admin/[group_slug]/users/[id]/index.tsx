import { component$ } from "@qwik.dev/core";
import { Link, routeLoader$ } from "@qwik.dev/router";
import { format } from "date-fns";
import { usersService } from "~/services/users.service";
import { membershipsService } from "~/services/memberships.service";
import { userTagsService } from "~/services/user-tags.service";
import { db } from "~/db/connection";
import { groupMemberships } from "~/db/schemas/group-memberships";
import { groups } from "~/db/schemas/groups";
import { logins } from "~/db/schemas/logins";
import { sessions } from "~/db/schemas/sessions";
import { desc, eq } from "drizzle-orm";

export const useUserProfile = routeLoader$(async ({ params }) => {
  const { id: userId, group_slug: groupSlug } = params;

  const [user, membership, allTags] = await Promise.all([
    usersService.getById(userId),
    membershipsService.getByUser(userId),
    userTagsService.getAll(),
  ]);

  if (!user) return null;

  const tags = allTags.filter((t) => t.userId === userId);

  const email = user.loginId
    ? await db
        .select({ email: logins.email })
        .from(logins)
        .where(eq(logins.id, user.loginId))
        .then((r) => r[0]?.email ?? null)
    : null;

  const [groupMembershipRows, lastLoginRow] = await Promise.all([
    db
      .select({
        groupId: groupMemberships.groupId,
        joinedAt: groupMemberships.joinedAt,
        name: groups.name,
        slug: groups.slug,
      })
      .from(groupMemberships)
      .innerJoin(groups, eq(groupMemberships.groupId, groups.id))
      .where(eq(groupMemberships.userId, userId)),
    db
      .select({ createdAt: sessions.createdAt })
      .from(sessions)
      .where(eq(sessions.userId, userId))
      .orderBy(desc(sessions.createdAt))
      .limit(1),
  ]);

  return {
    user,
    email,
    membership: membership ?? null,
    tags,
    groupMemberships: groupMembershipRows,
    lastLogin: lastLoginRow[0]?.createdAt ?? null,
    groupSlug,
  };
});

export default component$(() => {
  const data = useUserProfile();

  if (!data.value) {
    return <div class="text-gray-500 py-12 text-center">User not found.</div>;
  }

  const { user, email, membership, tags, groupMemberships: gms, lastLogin, groupSlug } =
    data.value;

  return (
    <div class="max-w-2xl">
      <div class="mb-6">
        <Link
          href={`/admin/${groupSlug}/users`}
          class="text-sm text-gray-500 hover:text-gray-700"
        >
          ← Back to users
        </Link>
      </div>

      <div class="bg-white rounded-lg shadow-sm p-6 mb-4">
        <div class="flex items-center gap-3 mb-4">
          <h2 class="text-2xl font-bold text-gray-800">
            {user.name} {user.familyName}
          </h2>
          {user.role !== "user" && (
            <span class="px-2 py-0.5 text-xs rounded bg-purple-100 text-purple-700 capitalize">
              {user.role}
            </span>
          )}
        </div>

        <dl class="grid grid-cols-2 gap-x-8 gap-y-4 text-sm">
          <div>
            <dt class="text-gray-500 mb-0.5">Email</dt>
            <dd class="font-medium text-gray-800">{email ?? "—"}</dd>
          </div>
          <div>
            <dt class="text-gray-500 mb-0.5">Location</dt>
            <dd class="font-medium text-gray-800">
              {[user.city, user.country].filter(Boolean).join(", ") || "—"}
            </dd>
          </div>
          <div>
            <dt class="text-gray-500 mb-0.5">Registered</dt>
            <dd class="font-medium text-gray-800">
              {format(new Date(user.createdAt), "MMM d, yyyy")}
            </dd>
          </div>
          <div>
            <dt class="text-gray-500 mb-0.5">Last login</dt>
            <dd class="font-medium text-gray-800">
              {lastLogin
                ? format(new Date(lastLogin), "MMM d, yyyy HH:mm")
                : "—"}
            </dd>
          </div>
          <div>
            <dt class="text-gray-500 mb-0.5">Membership tier</dt>
            <dd class="font-medium text-gray-800 capitalize">
              {membership?.tier ?? "None"}
            </dd>
          </div>
          {user.yearOfBirth && (
            <div>
              <dt class="text-gray-500 mb-0.5">Year of birth</dt>
              <dd class="font-medium text-gray-800">{user.yearOfBirth}</dd>
            </div>
          )}
        </dl>
      </div>

      {tags.length > 0 && (
        <div class="bg-white rounded-lg shadow-sm p-6 mb-4">
          <h3 class="text-sm font-semibold text-gray-700 mb-3">Tags</h3>
          <div class="flex flex-wrap gap-2">
            {tags.map((tag) => (
              <span
                key={tag.id}
                class="px-2.5 py-0.5 rounded-full text-xs bg-indigo-50 text-indigo-700 border border-indigo-100"
              >
                {tag.label}
              </span>
            ))}
          </div>
        </div>
      )}

      {gms.length > 0 && (
        <div class="bg-white rounded-lg shadow-sm p-6">
          <h3 class="text-sm font-semibold text-gray-700 mb-3">
            Group Memberships
          </h3>
          <ul class="divide-y divide-gray-100">
            {gms.map((gm) => (
              <li
                key={gm.groupId}
                class="py-2 flex items-center justify-between text-sm"
              >
                <span class="font-medium text-gray-800">{gm.name}</span>
                <span class="text-gray-500">
                  since {format(new Date(gm.joinedAt), "MMM d, yyyy")}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
});
