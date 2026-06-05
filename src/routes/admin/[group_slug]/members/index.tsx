import { component$ } from "@qwik.dev/core";
import { Form, routeAction$, routeLoader$, zod$, z } from "@qwik.dev/router";
import { usersService } from "~/services/users.service";
import { membershipsService } from "~/services/memberships.service";
import { userTagsService } from "~/services/user-tags.service";

export const useMembersData = routeLoader$(async (event) => {
  if (event.params.group_slug !== "global") {
    throw event.redirect(302, "/admin/global/members");
  }
  const { requireAdmin } = await import("~/utils/server-auth");
  await requireAdmin(event);

  const [usersRes, memberships] = await Promise.all([
    usersService.getAll(1000),
    membershipsService.getAll(),
  ]);

  const membershipMap = new Map(memberships.map((m) => [m.userId, m]));
  const members = usersRes.items.map((u) => ({
    ...u,
    membership: membershipMap.get(u.id) ?? null,
  }));

  return { members };
});

export const useSetTier = routeAction$(
  async (data, event) => {
    const { requireAdmin } = await import("~/utils/server-auth");
    const admin = await requireAdmin(event);
    await membershipsService.setTier(data.userId, data.tier, admin.id, data.notes || undefined);
    return { success: true };
  },
  zod$({
    userId: z.string().uuid(),
    tier: z.enum(["associated", "full"]),
    notes: z.string().optional(),
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
    await userTagsService.adminGrant(data.userId, data.slug, data.label, data.category as any, admin.id);
    return { success: true };
  },
  zod$({
    userId: z.string().uuid(),
    slug: z.string().min(1),
    label: z.string().min(1),
    category: z.enum(["board", "qualification", "participation", "custom"]),
  }),
);

export const useReevaluateBadges = routeAction$(
  async (_data, event) => {
    const { requireAdmin } = await import("~/utils/server-auth");
    await requireAdmin(event);
    const memberships = await membershipsService.getAll();
    await Promise.all(memberships.map((m) => userTagsService.evaluateRulesForUser(m.userId)));
    return { success: true, count: memberships.length };
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
  const reevalAction = useReevaluateBadges();

  return (
    <div>
      <div class="flex items-center justify-between mb-6">
        <h2 class="text-2xl font-bold text-gray-800">Members</h2>
        <Form action={reevalAction}>
          <button
            type="submit"
            class="text-sm text-blue-600 hover:text-blue-800 border border-blue-300 rounded px-3 py-1.5"
          >
            Re-evaluate badge rules for all
          </button>
        </Form>
      </div>

      <div class="bg-white rounded-lg shadow-sm overflow-hidden">
        <table class="min-w-full divide-y divide-gray-200">
          <thead class="bg-gray-50">
            <tr>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Membership</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Set Tier</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Grant Tag</th>
            </tr>
          </thead>
          <tbody class="bg-white divide-y divide-gray-200">
            {data.value.members.map((u) => (
              <tr key={u.id} class="hover:bg-gray-50 align-top">
                <td class="px-6 py-4 text-sm text-gray-900">
                  {u.name} {u.familyName}
                </td>
                <td class="px-6 py-4">
                  {tierBadge(u.membership?.tier ?? null)}
                  {u.membership && (
                    <Form action={removeAction} class="inline ml-2">
                      <input type="hidden" name="userId" value={u.id} />
                      <button
                        type="submit"
                        class="text-xs text-red-500 hover:text-red-700"
                        onClick$={(e) => {
                          if (!confirm("Remove membership?")) e.preventDefault();
                        }}
                      >
                        Remove
                      </button>
                    </Form>
                  )}
                </td>
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
                <td class="px-6 py-4">
                  <Form action={grantTagAction} class="flex items-center gap-1 flex-wrap">
                    <input type="hidden" name="userId" value={u.id} />
                    <input type="text" name="slug" placeholder="slug" class="text-xs border rounded px-2 py-1 w-24" required />
                    <input type="text" name="label" placeholder="label" class="text-xs border rounded px-2 py-1 w-24" required />
                    <select name="category" class="text-xs border rounded px-2 py-1">
                      <option value="custom">Custom</option>
                      <option value="board">Board</option>
                      <option value="qualification">Qualification</option>
                      <option value="participation">Participation</option>
                    </select>
                    <button type="submit" class="text-xs text-green-600 hover:text-green-800">
                      Grant
                    </button>
                  </Form>
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
