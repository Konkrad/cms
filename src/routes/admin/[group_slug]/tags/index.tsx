import { component$ } from "@qwik.dev/core";
import { Form, routeAction$, routeLoader$, zod$, z } from "@qwik.dev/router";
import { userTagsService } from "~/services/user-tags.service";

export const useTagsData = routeLoader$(async (event) => {
  if (event.params.group_slug !== "global") {
    throw event.redirect(302, "/admin/global/tags");
  }
  const { requireAdmin } = await import("~/utils/server-auth");
  await requireAdmin(event);
  const definitions = await userTagsService.getDefinitions();
  return { definitions };
});

export const useCreateDefinition = routeAction$(
  async (data, event) => {
    const { requireAdmin } = await import("~/utils/server-auth");
    await requireAdmin(event);
    await userTagsService.createDefinition(data as any);
    return { success: true };
  },
  zod$({
    slug: z.string().min(1).regex(/^[a-z0-9-]+$/, "Slug must be lowercase letters, numbers and hyphens only"),
    label: z.string().min(1),
    category: z.enum(["board", "qualification", "participation", "custom"]),
    description: z.string().optional(),
  }),
);

export const useDeleteDefinition = routeAction$(
  async (data, event) => {
    const { requireAdmin } = await import("~/utils/server-auth");
    await requireAdmin(event);
    await userTagsService.deleteDefinition(data.definitionId);
    return { success: true };
  },
  zod$({ definitionId: z.string().uuid() }),
);

const CATEGORY_COLORS: Record<string, string> = {
  board:         "bg-purple-100 text-purple-800",
  qualification: "bg-blue-100 text-blue-800",
  participation: "bg-green-100 text-green-800",
  custom:        "bg-gray-100 text-gray-700",
};

export default component$(() => {
  const data = useTagsData();
  const createAction = useCreateDefinition();
  const deleteAction = useDeleteDefinition();

  return (
    <div>
      <div class="flex items-center justify-between mb-6">
        <h2 class="text-2xl font-bold text-gray-800">Tag Definitions</h2>
      </div>
      <p class="text-sm text-gray-500 mb-6">
        Define the tags that can be assigned to members. Once created, tags appear
        in the Members page dropdown for quick assignment.
      </p>

      {createAction.value?.failed && (
        <div class="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
          {String((createAction.value as any).fieldErrors ?? "Something went wrong")}
        </div>
      )}

      <div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Existing definitions */}
        <div class="bg-white rounded-lg shadow-sm overflow-x-auto">
          <div class="px-5 py-3 bg-gray-50 border-b text-sm font-medium text-gray-700">
            Defined Tags ({data.value.definitions.length})
          </div>
          {data.value.definitions.length === 0 ? (
            <div class="px-5 py-8 text-center text-gray-400 text-sm">
              No tags defined yet. Add one using the form.
            </div>
          ) : (
            <ul class="divide-y divide-gray-100">
              {data.value.definitions.map((def) => (
                <li key={def.id} class="px-5 py-3 flex items-start justify-between gap-3">
                  <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-2 flex-wrap">
                      <span class="text-sm font-medium text-gray-900">{def.label}</span>
                      <span class={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium capitalize ${CATEGORY_COLORS[def.category] ?? "bg-gray-100 text-gray-700"}`}>
                        {def.category}
                      </span>
                    </div>
                    <div class="text-xs text-gray-400 font-mono mt-0.5">{def.slug}</div>
                    {def.description && (
                      <div class="text-xs text-gray-500 mt-0.5">{def.description}</div>
                    )}
                  </div>
                  <Form action={deleteAction} class="shrink-0">
                    <input type="hidden" name="definitionId" value={def.id} />
                    <button
                      type="submit"
                      preventdefault:click
                      class="text-xs text-red-500 hover:text-red-700"
                      onClick$={(e) => {
                        if (!confirm(`Delete tag "${def.label}"? Members who already have this tag keep it.`)) return;
                        (e.target as HTMLElement).closest("form")?.requestSubmit();
                      }}
                    >
                      Delete
                    </button>
                  </Form>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Add new definition */}
        <div class="bg-white rounded-lg shadow-sm p-5">
          <h3 class="text-base font-medium text-gray-900 mb-4">Add New Tag</h3>
          <Form action={createAction} class="space-y-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Label</label>
              <input
                type="text"
                name="label"
                required
                placeholder="e.g. Board Member 2026"
                class="w-full border rounded-md px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">
                Slug
                <span class="ml-1 text-gray-400 font-normal">(lowercase, hyphens only)</span>
              </label>
              <input
                type="text"
                name="slug"
                required
                placeholder="e.g. board-member-2026"
                class="w-full border rounded-md px-3 py-2 text-sm font-mono"
              />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Category</label>
              <select name="category" class="w-full border rounded-md px-3 py-2 text-sm">
                <option value="board">Board</option>
                <option value="custom">Custom</option>
                <option value="participation">Participation</option>
                <option value="qualification">Qualification</option>
              </select>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Description (optional)</label>
              <input
                type="text"
                name="description"
                placeholder="Shown on member profile"
                class="w-full border rounded-md px-3 py-2 text-sm"
              />
            </div>
            <button
              type="submit"
              class="w-full bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700"
            >
              Add Tag
            </button>
          </Form>
        </div>
      </div>
    </div>
  );
});
