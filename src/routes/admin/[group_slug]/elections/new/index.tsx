import { component$ } from "@qwik.dev/core";
import { Form, routeAction$, routeLoader$, zod$, z } from "@qwik.dev/router";

export const useGuard = routeLoader$(async (event) => {
  if (event.params.group_slug !== "global") {
    throw event.redirect(302, "/admin/global/elections/new");
  }
  const { requireAdmin } = await import("~/utils/server-auth");
  await requireAdmin(event);
  return {};
});

export const useCreateCycle = routeAction$(
  async (data, event) => {
    const { requireAdmin } = await import("~/utils/server-auth");
    await requireAdmin(event);
    const { electionsService } = await import("~/services/elections.service");
    const cycle = await electionsService.createCycle({
      title: data.title,
      year: data.year,
      description: data.description || undefined,
      requiredMembershipTier: (data.requiredMembershipTier as any) || null,
    });
    throw event.redirect(302, `/admin/global/elections/${cycle.id}`);
  },
  zod$({
    title: z.string().min(1, "Title is required"),
    year: z.coerce.number().int().min(2000).max(2100),
    description: z.string().optional(),
    requiredMembershipTier: z.enum(["associated", "full", ""]).optional(),
  }),
);

export default component$(() => {
  useGuard();
  const createAction = useCreateCycle();

  return (
    <div class="max-w-lg">
      <h2 class="text-2xl font-bold text-gray-800 mb-6">New Election Cycle</h2>

      {createAction.value?.failed && (
        <div class="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
          {String(createAction.value.fieldErrors ?? "Something went wrong")}
        </div>
      )}

      <Form action={createAction} class="bg-white rounded-lg shadow-sm p-6 space-y-4">
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Title</label>
          <input
            type="text"
            name="title"
            required
            placeholder="e.g. Board Elections 2026"
            class="w-full border rounded-md px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Year</label>
          <input
            type="number"
            name="year"
            required
            value={new Date().getFullYear()}
            class="w-full border rounded-md px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Description (optional)</label>
          <textarea
            name="description"
            rows={3}
            class="w-full border rounded-md px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Required Membership Tier</label>
          <select name="requiredMembershipTier" class="w-full border rounded-md px-3 py-2 text-sm">
            <option value="">None (any authenticated user)</option>
            <option value="associated">Associated Member</option>
            <option value="full">Full Member</option>
          </select>
        </div>
        <div class="flex gap-3 pt-2">
          <button
            type="submit"
            class="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700"
          >
            Create Cycle
          </button>
          <a href="/admin/global/elections" class="text-sm text-gray-500 hover:text-gray-700 py-2">
            Cancel
          </a>
        </div>
      </Form>
    </div>
  );
});
