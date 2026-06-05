import { component$ } from "@qwik.dev/core";
import { Form, routeAction$, routeLoader$, zod$, z } from "@qwik.dev/router";
import { electionsService } from "~/services/elections.service";

export const useGuard = routeLoader$(async (event) => {
  const { requireAdmin } = await import("~/utils/server-auth");
  await requireAdmin(event);
  const cycle = await electionsService.getCycleById(event.params.id);
  if (!cycle) throw event.redirect(302, "/admin/global/elections");
  if (cycle.status !== "draft") {
    throw event.redirect(302, `/admin/global/elections/${event.params.id}`);
  }
  return { cycle };
});

export const useCreatePosition = routeAction$(
  async (data, event) => {
    const { requireAdmin } = await import("~/utils/server-auth");
    await requireAdmin(event);
    await electionsService.createPosition({
      cycleId: data.cycleId,
      title: data.title,
      description: data.description || undefined,
      maxCandidates: data.maxCandidates || undefined,
    });
    throw event.redirect(302, `/admin/global/elections/${data.cycleId}`);
  },
  zod$({
    cycleId: z.string().uuid(),
    title: z.string().min(1, "Title is required"),
    description: z.string().optional(),
    maxCandidates: z.coerce.number().int().positive().optional(),
  }),
);

export default component$(() => {
  const guard = useGuard();
  const createAction = useCreatePosition();

  return (
    <div class="max-w-lg">
      <h2 class="text-2xl font-bold text-gray-800 mb-6">Add Position</h2>

      <Form action={createAction} class="bg-white rounded-lg shadow-sm p-6 space-y-4">
        <input type="hidden" name="cycleId" value={guard.value.cycle.id} />
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Position Title</label>
          <input
            type="text"
            name="title"
            required
            placeholder="e.g. Treasurer"
            class="w-full border rounded-md px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Description (optional)</label>
          <textarea name="description" rows={2} class="w-full border rounded-md px-3 py-2 text-sm" />
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Max Candidates (optional)</label>
          <input
            type="number"
            name="maxCandidates"
            min={1}
            class="w-full border rounded-md px-3 py-2 text-sm"
          />
        </div>
        <div class="flex gap-3 pt-2">
          <button
            type="submit"
            class="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700"
          >
            Add Position
          </button>
          <a
            href={`/admin/global/elections/${guard.value.cycle.id}`}
            class="text-sm text-gray-500 hover:text-gray-700 py-2"
          >
            Cancel
          </a>
        </div>
      </Form>
    </div>
  );
});
