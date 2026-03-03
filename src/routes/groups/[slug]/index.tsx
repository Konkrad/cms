import { component$ } from "@builder.io/qwik";
import { routeAction$, routeLoader$, Form } from "@builder.io/qwik-city";
import { groupsService } from "~/services/groups.service";
import { groupMembershipsService } from "~/services/group-memberships.service";
import { getCurrentUserData } from "~/utils/server-auth";

export const useGroup = routeLoader$(async ({ params, redirect }) => {
  const group = await groupsService.getBySlug(params.slug);

  if (!group) {
    throw redirect(302, "/groups");
  }

  return group;
});

export const useGroupMembership = routeLoader$(async (event) => {
  const { params } = event;
  const user = await getCurrentUserData(event as any);
  if (!user) return { isMember: false };

  const group = await groupsService.getBySlug(params.slug);
  if (!group) return { isMember: false };

  const isMember = await groupMembershipsService.isMember(user.id, group.id);
  return { isMember };
});

export const useJoinGroup = routeAction$(async (data, event) => {
  const { params, redirect } = event;
  const user = await getCurrentUserData(event as any);

  if (!user) {
    throw redirect(302, "/login");
  }

  const group = await groupsService.getBySlug(params.slug);
  if (!group) {
    return { success: false, error: "Group not found" };
  }

  try {
    await groupMembershipsService.join(user.id, group.id);
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message || "Failed to join group" };
  }
});

export default component$(() => {
  const group = useGroup();
  const membership = useGroupMembership();
  const joinAction = useJoinGroup();

  return (
    <div class="max-w-4xl mx-auto px-4 py-8">
      <div class="bg-white rounded-lg shadow-lg overflow-hidden">
        <div class="bg-gradient-to-r from-blue-600 to-blue-800 text-white p-8">
          <h1 class="text-4xl font-bold mb-2">{group.value.name}</h1>
          <p class="text-blue-100">
            📍 Location: {group.value.latitude}, {group.value.longitude}
          </p>
        </div>

        <div class="p-8">
          <div class="mb-6">
            {membership.value.isMember ? (
              <div class="bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded">
                ✓ You are a member of this group
              </div>
            ) : (
              <Form action={joinAction}>
                <button
                  type="submit"
                  class="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-lg font-semibold disabled:opacity-50"
                  disabled={joinAction.isRunning}
                >
                  {joinAction.isRunning ? "Joining..." : "Join This Group"}
                </button>
              </Form>
            )}

            {joinAction.value?.success && (
              <div class="mt-4 bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded">
                Successfully joined the group! Refreshing...
              </div>
            )}

            {joinAction.value?.error && (
              <div class="mt-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
                {joinAction.value.error}
              </div>
            )}
          </div>

          <div class="prose max-w-none">
            <h2 class="text-2xl font-semibold text-gray-900 mb-4">
              About This Group
            </h2>
            <p class="text-gray-600">
              This community group was created on{" "}
              {new Date(group.value.createdAt).toLocaleDateString()}.
            </p>
            <p class="text-gray-600 mt-4">
              Join this group to access group-specific posts, events, and
              connect with other members.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
});
