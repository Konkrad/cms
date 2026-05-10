import { component$ } from "@qwik.dev/core";
import {
  Form,
  routeAction$,
  routeLoader$,
  z,
  zod$,
} from "@qwik.dev/router";
import { Button } from "~/components/ui/Button";
import { db } from "~/db/connection";
import { groupMemberships, users } from "~/db/schema";
import { eq } from "drizzle-orm";
import { groupsService } from "~/services/groups.service";
import { groupRepresentativesService } from "~/services/group-representatives.service";
import { getCurrentUserData } from "~/utils/server-auth";

export const useMembers = routeLoader$(async ({ params, redirect }) => {
  // Only allow access from the global admin context
  if (params.group_slug !== "global") {
    throw redirect(302, `/admin/${params.group_slug}`);
  }

  const group = await groupsService.getById(params.id as string);
  if (!group) {
    throw redirect(302, "/admin/global/groups");
  }

  const members = await db
    .select({
      id: users.id,
      name: users.name,
      familyName: users.familyName,
      loginId: users.loginId,
      role: users.role,
      city: users.city,
      country: users.country,
      joinedAt: groupMemberships.joinedAt,
    })
    .from(groupMemberships)
    .innerJoin(users, eq(groupMemberships.userId, users.id))
    .where(eq(groupMemberships.groupId, group.id))
    .orderBy(groupMemberships.joinedAt);

  const reps = await groupRepresentativesService.getRepresentatives(group.id);
  const repIds = new Set(reps.map((r) => r.userId));

  const enriched = members.map((m) => ({
    ...m,
    displayName: `${m.name} ${m.familyName}`,
    isRep: repIds.has(m.id),
  }));

  return { group, members: enriched };
});

const promoteSchema = z.object({
  userId: z.string().uuid(),
});

export const usePromote = routeAction$(async (data, event) => {
  const user = await getCurrentUserData(event as any);
  if (!user || user.role !== "admin") {
    return { success: false, error: "Unauthorized" };
  }

  const groupId = event.params.id as string;
  try {
    await groupRepresentativesService.promote(data.userId, groupId, user.id);
    throw event.redirect(303, `/admin/global/groups/${groupId}/members`);
  } catch (error: any) {
    if (error?.status === 303) throw error;
    return {
      success: false,
      error: error?.message || "Failed to promote user",
    };
  }
}, zod$(promoteSchema));

export default component$(() => {
  const data = useMembers();
  const promote = usePromote();

  return (
    <div>
      <div class="flex items-center justify-between mb-6">
        <h2 class="text-2xl font-bold text-gray-800">
          Manage Members − {data.value.group.name}
        </h2>
        <Button href="/admin/global/groups" variant="secondary">Back to Groups</Button>
      </div>

      {promote.value?.error && (
        <div class="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {promote.value.error}
        </div>
      )}

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
                Member Since
              </th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody class="bg-white divide-y divide-gray-200">
            {data.value.members.map((m) => (
              <tr key={m.id} class="hover:bg-gray-50">
                <td class="px-6 py-4">
                  <div class="text-sm font-medium text-gray-900">
                    {m.displayName}
                  </div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                  <div class="text-sm text-gray-900">{m.loginId ?? ""}</div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                  <span
                    class={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                      m.role === "admin"
                        ? "bg-purple-100 text-purple-800"
                        : "bg-green-100 text-green-800"
                    }`}
                  >
                    {m.role}
                  </span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {new Date(m.joinedAt).toLocaleDateString()}
                </td>
                <td class="px-6 py-4 text-sm font-medium">
                  <div class="flex items-center gap-4">
                    {m.isRep ? (
                      <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-purple-100 text-purple-800">
                        Representative
                      </span>
                    ) : (
                      <Form action={promote}>
                        <input type="hidden" name="userId" value={m.id} />
                        <button
                          type="submit"
                          class="text-green-600 hover:text-green-900"
                          onClick$={(e) => {
                            if (
                              !confirm("Promote this member to representative?")
                            ) {
                              e.preventDefault();
                            }
                          }}
                        >
                          Promote
                        </button>
                      </Form>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {data.value.members.length === 0 && (
          <div class="text-center py-12 text-gray-500">
            No members found for this group.
          </div>
        )}
      </div>
    </div>
  );
});
