import { component$ } from "@builder.io/qwik";
import { routeAction$, Form, zod$, z } from "@builder.io/qwik-city";
import { groupsService } from "~/services/groups.service";
import { generateSlug } from "~/utils/group-slug";

export const useCreateGroup = routeAction$(
  async (data, { redirect }) => {
    try {
      const group = await groupsService.create({
        name: data.name,
        latitude: data.latitude,
        longitude: data.longitude,
        slug: generateSlug(data.name),
      });

      throw redirect(302, `/admin/global/groups`);
    } catch (error: any) {
      return {
        success: false,
        error: error.message || "Failed to create group",
      };
    }
  },
  zod$({
    name: z.string().min(1, "Group name is required"),
    latitude: z
      .string()
      .refine(
        (val) => {
          const num = parseFloat(val);
          return !isNaN(num) && num >= -90 && num <= 90;
        },
        { message: "Latitude must be between -90 and 90" }
      ),
    longitude: z
      .string()
      .refine(
        (val) => {
          const num = parseFloat(val);
          return !isNaN(num) && num >= -180 && num <= 180;
        },
        { message: "Longitude must be between -180 and 180" }
      ),
  })
);

export default component$(() => {
  const createAction = useCreateGroup();

  return (
    <div>
      <h2 class="text-2xl font-bold text-gray-900 mb-6">Create New Group</h2>

      <div class="bg-white rounded-lg shadow p-6 max-w-2xl">
        <Form action={createAction} class="space-y-4">
          <div>
            <label for="name" class="block text-sm font-medium text-gray-700 mb-1">
              Group Name *
            </label>
            <input
              type="text"
              id="name"
              name="name"
              required
              class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g., Paris Community"
            />
          </div>

          <div class="grid grid-cols-2 gap-4">
            <div>
              <label for="latitude" class="block text-sm font-medium text-gray-700 mb-1">
                Latitude *
              </label>
              <input
                type="text"
                id="latitude"
                name="latitude"
                required
                class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g., 48.8566"
              />
              <p class="text-xs text-gray-500 mt-1">Range: -90 to 90</p>
            </div>

            <div>
              <label for="longitude" class="block text-sm font-medium text-gray-700 mb-1">
                Longitude *
              </label>
              <input
                type="text"
                id="longitude"
                name="longitude"
                required
                class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g., 2.3522"
              />
              <p class="text-xs text-gray-500 mt-1">Range: -180 to 180</p>
            </div>
          </div>

          {createAction.value?.error && (
            <div class="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
              {createAction.value.error}
            </div>
          )}

          <div class="flex gap-3 pt-4">
            <button
              type="submit"
              class="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors disabled:opacity-50"
              disabled={createAction.isRunning}
            >
              {createAction.isRunning ? "Creating..." : "Create Group"}
            </button>
            <a
              href="/admin/global/groups"
              class="px-6 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition-colors"
            >
              Cancel
            </a>
          </div>
        </Form>
      </div>
    </div>
  );
});
