import { component$ } from "@qwik.dev/core";
import { Form, Link, routeAction$, routeLoader$, zod$, z } from "@qwik.dev/router";
import { usersService } from "~/services/users.service";
import { membershipsService } from "~/services/memberships.service";
import { userTagsService } from "~/services/user-tags.service";

export const useMembersData = routeLoader$(async (event) => {
  if (event.params.group_slug !== "global") {
    throw event.redirect(302, "/admin/global/members");
  }
  const { requireAdmin } = await import("~/utils/server-auth");
  await requireAdmin(event);

  const [usersRes, memberships, allTags, definitions] = await Promise.all([
    usersService.getAll(1000),
    membershipsService.getAll(),
    userTagsService.getAll(),
    userTagsService.getDefinitions(),
  ]);

  const membershipMap = new Map(memberships.map((m) => [m.userId, m]));
  const tagsByUser = new Map<string, typeof allTags>();
  for (const tag of allTags) {
    if (!tagsByUser.has(tag.userId)) tagsByUser.set(tag.userId, []);
    tagsByUser.get(tag.userId)!.push(tag);
  }

  const members = usersRes.items.map((u) => ({
    ...u,
    membership: membershipMap.get(u.id) ?? null,
    tags: tagsByUser.get(u.id) ?? [],
  }));

  return { members, definitions };
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
    await userTagsService.grantFromDefinition(data.userId, data.definitionId, admin.id);
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

export const useReevaluateBadges = routeAction$(
  async (_data, event) => {
    const { requireAdmin } = await import("~/utils/server-auth");
    await requireAdmin(event);
    const memberships = await membershipsService.getAll();
    await Promise.all(memberships.map((m) => userTagsService.evaluateRulesForUser(m.userId)));
    return { success: true };
  },
  zod$({}),
);

const tierBadge = (tier: string | null) => {
  if (!tier) return <span class="text-gray-400 text-xs">None</span>;
  const cls = tier === "full" ? "bg-blue-100 text-blue-800" : "bg-gray-100 text-gray-700";
  return (
    <span class={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${cls}`}>
      {tier}
    </span>
  );
};

export default component$(() => {
  const data = useMembersData();
  const setTierAction = useSetTier();
  const removeAction = useRemoveMembership();
  const grantTagAction = useGrantTag();
  const revokeTagAction = useRevokeTag();
  const reevalAction = useReevaluateBadges();

  return (
    <div>
      <div class="flex items-center justify-between mb-6">
        <h2 class="text-2xl font-bold text-gray-800">Members</h2>
        <div class="flex items-center gap-3">
          <Link href="/admin/global/tags" class="text-sm text-gray-500 hover:text-gray-700 border border-gray-300 rounded px-3 py-1.5">
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
      </div>

      {data.value.definitions.length === 0 && (
        <div class="mb-4 p-3 bg-amber-50 border border-amber-200 rounded text-amber-800 text-sm">
          No tag definitions yet.{" "}
          <a href="/admin/global/tags" class="underline font-medium">Add some tags</a>{" "}
          before you can assign them to members.
        </div>
      )}

      <div class="bg-white rounded-lg shadow-sm overflow-hidden">
        <table class="min-w-full divide-y divide-gray-200">
          <thead class="bg-gray-50">
            <tr>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Membership</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Set Tier</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tags</th>
            </tr>
          </thead>
          <tbody class="bg-white divide-y divide-gray-200">
            {data.value.members.map((u) => (
              <tr key={u.id} class="hover:bg-gray-50 align-top">
                <td class="px-6 py-4 text-sm text-gray-900">
                  {u.name} {u.familyName}
                </td>

                {/* Membership tier */}
                <td class="px-6 py-4">
                  {tierBadge(u.membership?.tier ?? null)}
                  {u.membership && (
                    <Form action={removeAction} class="inline ml-2">
                      <input type="hidden" name="userId" value={u.id} />
                      <button
                        type="submit"
                        preventdefault:click
                        class="text-xs text-red-500 hover:text-red-700"
                        onClick$={(e) => {
                          if (!confirm("Remove membership?")) return;
                          (e.target as HTMLElement).closest("form")?.requestSubmit();
                        }}
                      >
                        Remove
                      </button>
                    </Form>
                  )}
                </td>

                {/* Set tier */}
                <td class="px-6 py-4">
                  <Form action={setTierAction} class="flex items-center gap-2">
                    <input type="hidden" name="userId" value={u.id} />
                    <select name="tier" class="text-xs border rounded px-2 py-1">
                      <option value="associated">Associated</option>
                      <option value="full">Full</option>
                    </select>
                    <button type="submit" class="text-xs text-blue-600 hover:text-blue-800">
                      Set
                    </button>
                  </Form>
                </td>

                {/* Tags */}
                <td class="px-6 py-4">
                  {/* Existing tags */}
                  {u.tags.length > 0 && (
                    <div class="flex flex-wrap gap-1 mb-2">
                      {u.tags.map((tag) => (
                        <span
                          key={tag.id}
                          class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-indigo-50 text-indigo-700 border border-indigo-100"
                        >
                          {tag.label}
                          {tag.sourceType === "manual" && (
                            <Form action={revokeTagAction} class="inline">
                              <input type="hidden" name="userId" value={u.id} />
                              <input type="hidden" name="slug" value={tag.slug} />
                              <button
                                type="submit"
                                preventdefault:click
                                class="ml-0.5 text-indigo-400 hover:text-red-500 leading-none"
                                title="Revoke tag"
                                onClick$={(e) => {
                                  if (!confirm(`Revoke "${tag.label}" from this user?`)) return;
                                  (e.target as HTMLElement).closest("form")?.requestSubmit();
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
                    <Form action={grantTagAction} class="flex items-center gap-1">
                      <input type="hidden" name="userId" value={u.id} />
                      <select name="definitionId" class="text-xs border rounded px-2 py-1 max-w-[160px]">
                        {data.value.definitions.map((def) => (
                          <option key={def.id} value={def.id}>{def.label}</option>
                        ))}
                      </select>
                      <button type="submit" class="text-xs text-green-600 hover:text-green-800 whitespace-nowrap">
                        Assign
                      </button>
                    </Form>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {data.value.members.length === 0 && (
          <div class="text-center py-12 text-gray-500">No users found.</div>
        )}
      </div>
    </div>
  );
});
