import { component$ } from "@builder.io/qwik";
import { routeAction$, routeLoader$, Form, zod$, z } from "@builder.io/qwik-city";
import { groupsService } from "~/services/groups.service";
import { groupMembershipsService } from "~/services/group-memberships.service";
import { groupRepresentativesService } from "~/services/group-representatives.service";
import { getCurrentUserData } from "~/utils/server-auth";
import { db } from "~/db/connection";
import { users } from "~/db/schema";
import { inArray } from "drizzle-orm";

export const useGroupData = routeLoader$(async ({ params, redirect }) => {
  const group = await groupsService.getById(params.id);
  if (!group) {
    throw redirect(302, "/admin/global/groups");
  }
  return group;
});

export const useGroupMembers = routeLoader$(async ({ params }) => {
  const memberships = await groupMembershipsService.getGroupMembers(params.id);
  
  if (memberships.length === 0) {
    return [];
  }

  const userIds = memberships.map((m) => m.userId);
  const memberUsers = await db
    .select()
    .from(users)
    .where(inArray(users.id, userIds));

  // Get representatives
  const representatives = await groupRepresentativesService.getRepresentatives(params.id);
  const repIds = new Set(representatives.map((r) => r.userId));

  return memberUsers.map((user) => ({
    ...user,
    isRepresentative: repIds.has(user.id),
    joinedAt: memberships.find((m) => m.userId === user.id)?.joinedAt,
  }));
});

export const usePromoteMember = routeAction$(
  async (data, { params, sharedMap }) => {
    const admin = await getCurrentUserData({ sharedMap } as any);
    if (!admin || admin.role !== "admin") {
      return { success: false, error: "Unauthorized" };
    }

    try {
      await groupRepresentativesService.promote(
        data.userId,
        params.id,
        admin.id
      );
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message || "Failed to promote member" };
    }
  },
  zod$({
    userId: z.string(),
  })
);

export default component$(() => {
  const group = useGroupData();
  const members = useGroupMembers();
  const promoteAction = usePromoteMember();

  return (
    <div>
      <div class="mb-6">
        <h2 class="text-2xl font-bold text-gray-900 mb-2">
          Group Members: {group.value.name}
        </h2>
        <p class="text-gray-600">
          Manage members and promote them to community representatives
        </p>
      </div>

      {promoteAction.value?.success && (
        <div class="mb-4 bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded">
          Member promoted successfully!
        </div>
      )}

      {promoteAction.value?.error && (
        <div class="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {promoteAction.value.error}
        </div>
      )}

      {members.value.length === 0 ? (
        <div class="bg-white rounded-lg shadow p-8 text-center">
          <p class="text-gray-600">No members in this group yet.</p>
        </div>
      ) : (
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
                  Joined
                </th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Role
                </th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody class="bg-white divide-y divide-gray-200">
              {members.value.map((member) => (
                <tr key={member.id}>
                  <td class="px-6 py-4 whitespace-nowrap">
                    <div class="text-sm font-medium text-gray-900">
                      {member.displayName}
                    </div>
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap">
                    <div class="text-sm text-gray-500">{member.loginId || "N/A"}</div>
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap">
                    <div class="text-sm text-gray-500">
                      {member.joinedAt
                        ? new Date(member.joinedAt).toLocaleDateString()
                        : "N/A"}
                    </div>
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap">
                    {member.isRepresentative ? (
                      <span class="px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                        Representative
                      </span>
                    ) : (
                      <span class="px-2 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-800">
                        Member
                      </span>
                    )}
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm">
                    {!member.isRepresentative && (
                      <Form action={promoteAction}>
                        <input type="hidden" name="userId" value={member.id} />
                        <button
                          type="submit"
                          class="text-blue-600 hover:text-blue-900 font-medium disabled:opacity-50"
                          disabled={promoteAction.isRunning}
                        >
                          Promote
                        </button>
                      </Form>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
});
