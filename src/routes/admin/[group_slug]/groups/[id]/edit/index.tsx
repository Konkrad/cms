import { component$ } from "@builder.io/qwik";
import {
  Form,
  routeAction$,
  routeLoader$,
  z,
  zod$,
} from "@builder.io/qwik-city";
import { Button } from "~/components/ui/Button";
import { Input } from "~/components/ui/Input";
import { groupsService } from "~/services/groups.service";
import { geocodingService } from "~/services/geocoding.service";
import { getCurrentUserData } from "~/utils/server-auth";

export const useGroup = routeLoader$(async ({ params, redirect }) => {
  // Only valid in the global admin context
  const groupSlug = params.group_slug;
  if (groupSlug !== "global") {
    throw redirect(302, `/admin/${groupSlug}`);
  }

  const group = await groupsService.getById(params.id as string);
  if (!group) {
    throw redirect(302, "/admin/global/groups");
  }

  // Attempt to reverse geocode the existing coordinates so we can present
  // a friendly location string in the form.
  let displayLocation: string | undefined;
  try {
    const lat = parseFloat(group.latitude);
    const lon = parseFloat(group.longitude);
    const geo = await geocodingService.reverse(lat, lon);
    displayLocation =
      geo?.displayName ?? `${group.latitude}, ${group.longitude}`;
  } catch (err) {
    displayLocation = `${group.latitude}, ${group.longitude}`;
  }

  return { ...group, displayLocation };
});

const updateSchema = z.object({
  name: z.string().min(1, "Name is required"),
  slug: z.string().optional(),
  location: z.string().min(1, "Location is required"),
});

export const useUpdateGroup = routeAction$(async (data, event) => {
  const user = await getCurrentUserData(event as any);
  if (!user || user.role !== "admin") {
    return { success: false, error: "Unauthorized" };
  }

  // Ensure the request is coming from the global admin context
  const groupSlug = event.params.group_slug;
  if (groupSlug !== "global") {
    return { success: false, error: "Not allowed in this context" };
  }

  try {
    // Geocode the provided location string to obtain lat/lon
    const results = await geocodingService.forward(data.location);
    if (!results || results.length === 0) {
      return {
        success: false,
        error: "Unable to geocode the provided location",
      };
    }
    const best = results[0];

    await groupsService.update(
      event.params.id as string,
      {
        name: data.name,
        slug: data.slug || undefined,
        latitude: String(best.latitude),
        longitude: String(best.longitude),
      } as any,
    );

    throw event.redirect(303, "/admin/global/groups");
  } catch (error: any) {
    if (error?.status === 303) throw error;
    return {
      success: false,
      error: error?.message || "Failed to update group",
    };
  }
}, zod$(updateSchema));

export default component$(() => {
  const group = useGroup();
  const action = useUpdateGroup();

  return (
    <div>
      <div class="flex items-center justify-between mb-6">
        <h2 class="text-2xl font-bold text-gray-800">Edit Group</h2>
        <a href="/admin/global/groups">
          <Button variant="secondary">Back to Groups</Button>
        </a>
      </div>

      <div class="bg-white rounded-lg shadow p-6">
        <Form action={action} class="space-y-6">
          <Input name="name" label="Name" value={group.value.name} required />
          <Input name="slug" label="Slug" value={group.value.slug} />
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">
              Location
            </label>
            <Input
              name="location"
              placeholder="e.g. Berlin, Germany or Alexanderplatz, Berlin"
              value={
                group.value.displayLocation ??
                `${group.value.latitude}, ${group.value.longitude}`
              }
              required
            />
          </div>

          {action.value?.error && (
            <div class="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
              {action.value.error}
            </div>
          )}

          <div class="flex gap-4">
            <Button type="submit">Save Group</Button>
            <a href="/admin/global/groups">
              <Button variant="secondary">Cancel</Button>
            </a>
          </div>
        </Form>
      </div>
    </div>
  );
});
