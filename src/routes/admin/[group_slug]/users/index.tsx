import { component$ } from "@builder.io/qwik";
import { routeLoader$ } from "@builder.io/qwik-city";
import { format } from "date-fns";
import { usersService } from "~/services/users.service";
import { groupsService } from "~/services/groups.service";
import { db } from "~/db/connection";
import { groupMemberships, logins, users } from "~/db/schema";
import { eq } from "drizzle-orm";

export const useUsers = routeLoader$(async ({ params }) => {
  const groupSlug = params.group_slug;

  // For global admin, show all users
  if (groupSlug === "global") {
    const res = await usersService.getAll(1000); // Large limit for all users
    // Fetch emails from logins table
    const loginIds = res.items.map((u) => u.loginId).filter(Boolean) as string[];
    const loginRows = loginIds.length
      ? await db.select({ id: logins.id, email: logins.email }).from(logins)
      : [];
    const emailMap = new Map(loginRows.map((l) => [l.id, l.email]));
    const usersWithEmail = res.items.map((u) => ({
      ...u,
      email: u.loginId ? emailMap.get(u.loginId) ?? null : null,
    }));
    return { users: usersWithEmail, groupSlug, isGlobal: true };
  }

  // For group representatives, show only group members
  const group = await groupsService.getBySlug(groupSlug);
  if (!group) {
    return { users: [], groupSlug, isGlobal: false };
  }

  // Get all members of this group with user details and email
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
      joinedAt: groupMemberships.createdAt,
    })
    .from(groupMemberships)
    .innerJoin(users, eq(groupMemberships.userId, users.id))
    .leftJoin(logins, eq(users.loginId, logins.id))
    .where(eq(groupMemberships.groupId, group.id))
    .orderBy(groupMemberships.createdAt);

  return { users: members, groupSlug, isGlobal: false };
});

export default component$(() => {
  const data = useUsers();

  return (
    <div>
      <div class="flex items-center justify-between mb-6">
        <h2 class="text-2xl font-bold text-gray-800">
          {data.value.isGlobal ? "All Users" : "Group Members"}
        </h2>
      </div>

      <div class="bg-white rounded-lg shadow overflow-hidden">
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
                Role
              </th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Location
              </th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                {data.value.isGlobal ? "Joined" : "Member Since"}
              </th>
            </tr>
          </thead>
          <tbody class="bg-white divide-y divide-gray-200">
            {data.value.users.map((user) => (
              <tr key={user.id} class="hover:bg-gray-50">
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
