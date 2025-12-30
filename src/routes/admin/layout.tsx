import { component$, Slot } from "@builder.io/qwik";
import { routeLoader$ } from "@builder.io/qwik-city";
import { requireAdmin } from "~/utils/server-auth";

export const useAdminAuth = routeLoader$(async (event) => {
  await requireAdmin(event);
  const user = event.sharedMap.get("session");
  return { user };
});

export default component$(() => {
  return (
    <div class="min-h-screen bg-gray-50">
      <div class="max-w-7xl mx-auto px-4 py-8">
        <Slot />
      </div>
    </div>
  );
});
