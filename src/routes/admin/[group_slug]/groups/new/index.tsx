import { component$, useSignal } from "@builder.io/qwik";
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

export const useGlobalOnly = routeLoader$(async ({ params, redirect }) => {
  const groupSlug = params.group_slug;
  // Only valid in the global admin context
  if (groupSlug !== "global") {
    throw redirect(302, `/admin/${groupSlug}`);
  }
  return { isGlobal: true };
});

const groupSchema = z.object({
  name: z.string().min(1, "Name is required"),
  location: z.string().min(1, "Location is required"),
});

export const useCreateGroup = routeAction$(async (data, event) => {
  // Ensure user is authenticated and a platform admin
  const user = await getCurrentUserData(event as any);
  if (!user || user.role !== "admin") {
    return { success: false, error: "Unauthorized" };
  }

  // Only allowed from global admin context
  const groupSlug = event.params.group_slug;
  if (groupSlug !== "global") {
    return { success: false, error: "Not allowed in this context" };
  }

  try {
    // Geocode the provided location string
    const results = await geocodingService.forward(data.location);
    if (!results || results.length === 0) {
      return {
        success: false,
        error: "Unable to find location. Please enter a more specific address.",
      };
    }

    const best = results[0];

    await groupsService.create({
      name: data.name,
      latitude: String(best.latitude),
      longitude: String(best.longitude),
    } as any);

    // Redirect back to the groups list after creation
    throw event.redirect(303, "/admin/global/groups");
  } catch (error: any) {
    if (error?.status === 303) throw error;
    return {
      success: false,
      error: error?.message || "Failed to create group",
    };
  }
}, zod$(groupSchema));

export default component$(() => {
  const createGroupAction = useCreateGroup();
  useGlobalOnly(); // Ensure we fail fast on UI if not in global context
  const isSubmitting = useSignal(false);

  return (
    <div>
      <div class="flex items-center justify-between mb-6">
        <h2 class="text-2xl font-bold text-gray-800">Create New Group</h2>
        <a href="/admin/global/groups">
          <Button variant="secondary">Back to Groups</Button>
        </a>
      </div>

      <div class="bg-white rounded-lg shadow p-6">
        <Form action={createGroupAction} class="space-y-6">
          <Input
            name="name"
            label="Name"
            placeholder="e.g. Berlin Community"
            required
          />
          <Input
            name="location"
            label="Location"
            placeholder="e.g. Berlin, Germany or Alexanderplatz, Berlin"
            required
          />

          {createGroupAction.value?.error && (
            <div class="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
              {createGroupAction.value.error}
            </div>
          )}

          <div class="flex gap-4">
            <Button
              type="submit"
              onClick$={() => {
                isSubmitting.value = true;
                // isSubmitting will be reset when navigation happens (redirect)
              }}
            >
              {isSubmitting.value ? "Creating..." : "Create Group"}
            </Button>
            <a href="/admin/global/groups">
              <Button variant="secondary">Cancel</Button>
            </a>
          </div>
        </Form>
      </div>
    </div>
  );
});
