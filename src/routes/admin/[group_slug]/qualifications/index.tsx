import { component$, useSignal } from "@qwik.dev/core";
import { Form, routeAction$, routeLoader$, zod$, z } from "@qwik.dev/router";
import { qualificationsService } from "~/services/qualifications.service";

export const useQualificationsData = routeLoader$(async (event) => {
  if (event.params.group_slug !== "global") {
    throw event.redirect(302, "/admin/global/qualifications");
  }
  const { requireAdmin } = await import("~/utils/server-auth");
  await requireAdmin(event);
  const [types, pending, all] = await Promise.all([
    qualificationsService.getTypes(),
    qualificationsService.getPendingApplications(),
    qualificationsService.getAllApplications(),
  ]);
  return { types, pending, all };
});

export const useCreateType = routeAction$(
  async (data, event) => {
    const { requireAdmin } = await import("~/utils/server-auth");
    await requireAdmin(event);
    await qualificationsService.createType(data as any);
    return { success: true };
  },
  zod$({
    slug: z.string().min(1),
    label: z.string().min(1),
    description: z.string().optional(),
    grantsMembershipTier: z.enum(["associated", "full"]),
  }),
);

export const useDeleteType = routeAction$(
  async (data, event) => {
    const { requireAdmin } = await import("~/utils/server-auth");
    await requireAdmin(event);
    await qualificationsService.deleteType(data.typeId);
    return { success: true };
  },
  zod$({ typeId: z.string().uuid() }),
);

export const useApproveQualification = routeAction$(
  async (data, event) => {
    const { requireAdmin, getCurrentUserData } = await import("~/utils/server-auth");
    const user = await requireAdmin(event);
    await qualificationsService.approve(data.qualId, user.id, data.notes || undefined);
    return { success: true };
  },
  zod$({ qualId: z.string().uuid(), notes: z.string().optional() }),
);

export const useRejectQualification = routeAction$(
  async (data, event) => {
    const { requireAdmin } = await import("~/utils/server-auth");
    const user = await requireAdmin(event);
    await qualificationsService.reject(data.qualId, user.id, data.notes);
    return { success: true };
  },
  zod$({ qualId: z.string().uuid(), notes: z.string().min(1, "Please provide a reason") }),
);

export default component$(() => {
  const data = useQualificationsData();
  const createTypeAction = useCreateType();
  const deleteTypeAction = useDeleteType();
  const approveAction = useApproveQualification();
  const rejectAction = useRejectQualification();
  const activeTab = useSignal<"pending" | "all" | "types">("pending");

  const statusBadge = (status: string) => {
    const map: Record<string, string> = {
      pending: "bg-yellow-100 text-yellow-800",
      approved: "bg-green-100 text-green-800",
      rejected: "bg-red-100 text-red-800",
    };
    return `inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${map[status] ?? "bg-gray-100 text-gray-800"}`;
  };

  return (
    <div>
      <div class="flex items-center justify-between mb-6">
        <h2 class="text-2xl font-bold text-gray-800">Qualifications</h2>
      </div>

      <div class="flex gap-2 mb-6 border-b">
        {(["pending", "all", "types"] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            class={[
              "px-4 py-2 text-sm font-medium -mb-px border-b-2",
              activeTab.value === tab
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-gray-500 hover:text-gray-700",
            ].join(" ")}
            onClick$={() => (activeTab.value = tab)}
          >
            {tab === "pending"
              ? `Pending (${data.value.pending.length})`
              : tab === "all"
                ? "All Applications"
                : "Types"}
          </button>
        ))}
      </div>

      {activeTab.value === "pending" && (
        <div class="bg-white rounded-lg shadow-sm overflow-hidden">
          <table class="min-w-full divide-y divide-gray-200">
            <thead class="bg-gray-50">
              <tr>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">User</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Submitted</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody class="bg-white divide-y divide-gray-200">
              {data.value.pending.map((q) => (
                <tr key={q.id} class="hover:bg-gray-50">
                  <td class="px-6 py-4 text-sm text-gray-900">
                    {(q as any).user?.name} {(q as any).user?.familyName}
                  </td>
                  <td class="px-6 py-4 text-sm text-gray-700">{q.type.label}</td>
                  <td class="px-6 py-4 text-sm text-gray-500">{q.createdAt.slice(0, 10)}</td>
                  <td class="px-6 py-4">
                    <div class="flex flex-col gap-2">
                      <Form action={approveAction} class="flex items-center gap-2">
                        <input type="hidden" name="qualId" value={q.id} />
                        <input
                          type="text"
                          name="notes"
                          placeholder="Optional note"
                          class="text-xs border rounded px-2 py-1 w-40"
                        />
                        <button type="submit" class="text-green-600 hover:text-green-900 text-sm font-medium">
                          Approve
                        </button>
                      </Form>
                      <Form action={rejectAction} class="flex items-center gap-2">
                        <input type="hidden" name="qualId" value={q.id} />
                        <input
                          type="text"
                          name="notes"
                          placeholder="Reason (required)"
                          class="text-xs border rounded px-2 py-1 w-40"
                          required
                        />
                        <button type="submit" class="text-red-600 hover:text-red-900 text-sm font-medium">
                          Reject
                        </button>
                      </Form>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {data.value.pending.length === 0 && (
            <div class="text-center py-12 text-gray-500">No pending qualifications.</div>
          )}
        </div>
      )}

      {activeTab.value === "all" && (
        <div class="bg-white rounded-lg shadow-sm overflow-hidden">
          <table class="min-w-full divide-y divide-gray-200">
            <thead class="bg-gray-50">
              <tr>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">User</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Notes</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
              </tr>
            </thead>
            <tbody class="bg-white divide-y divide-gray-200">
              {data.value.all.map((q) => (
                <tr key={q.id} class="hover:bg-gray-50">
                  <td class="px-6 py-4 text-sm text-gray-900">
                    {(q as any).user?.name} {(q as any).user?.familyName}
                  </td>
                  <td class="px-6 py-4 text-sm text-gray-700">{q.type.label}</td>
                  <td class="px-6 py-4">
                    <span class={statusBadge(q.status)}>{q.status}</span>
                  </td>
                  <td class="px-6 py-4 text-sm text-gray-500">{q.notes ?? "—"}</td>
                  <td class="px-6 py-4 text-sm text-gray-500">{q.createdAt.slice(0, 10)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {data.value.all.length === 0 && (
            <div class="text-center py-12 text-gray-500">No qualification applications yet.</div>
          )}
        </div>
      )}

      {activeTab.value === "types" && (
        <div class="space-y-6">
          <div class="bg-white rounded-lg shadow-sm overflow-hidden">
            <table class="min-w-full divide-y divide-gray-200">
              <thead class="bg-gray-50">
                <tr>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Label</th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Slug</th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Grants Tier</th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody class="bg-white divide-y divide-gray-200">
                {data.value.types.map((t) => (
                  <tr key={t.id} class="hover:bg-gray-50">
                    <td class="px-6 py-4 text-sm font-medium text-gray-900">{t.label}</td>
                    <td class="px-6 py-4 text-sm text-gray-500 font-mono">{t.slug}</td>
                    <td class="px-6 py-4 text-sm text-gray-700 capitalize">{t.grantsMembershipTier}</td>
                    <td class="px-6 py-4">
                      <Form action={deleteTypeAction}>
                        <input type="hidden" name="typeId" value={t.id} />
                        <button
                          type="submit"
                          class="text-red-600 hover:text-red-900 text-sm"
                          onClick$={(e) => {
                            if (!confirm(`Delete type "${t.label}"?`)) e.preventDefault();
                          }}
                        >
                          Delete
                        </button>
                      </Form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {data.value.types.length === 0 && (
              <div class="text-center py-8 text-gray-500">No qualification types yet.</div>
            )}
          </div>

          <div class="bg-white rounded-lg shadow-sm p-6">
            <h3 class="text-lg font-medium text-gray-900 mb-4">Add Qualification Type</h3>
            <Form action={createTypeAction} class="grid grid-cols-2 gap-4">
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Label</label>
                <input
                  type="text"
                  name="label"
                  required
                  placeholder="e.g. Master School Graduate"
                  class="w-full border rounded-md px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Slug</label>
                <input
                  type="text"
                  name="slug"
                  required
                  placeholder="e.g. master-school"
                  class="w-full border rounded-md px-3 py-2 text-sm font-mono"
                />
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Grants Membership Tier</label>
                <select name="grantsMembershipTier" class="w-full border rounded-md px-3 py-2 text-sm">
                  <option value="associated">Associated</option>
                  <option value="full">Full</option>
                </select>
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Description (optional)</label>
                <input
                  type="text"
                  name="description"
                  placeholder="Shown on user profile"
                  class="w-full border rounded-md px-3 py-2 text-sm"
                />
              </div>
              <div class="col-span-2">
                <button
                  type="submit"
                  class="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700"
                >
                  Add Type
                </button>
              </div>
            </Form>
          </div>
        </div>
      )}
    </div>
  );
});
