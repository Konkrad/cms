import { component$, Slot } from "@qwik.dev/core";
import type { RequestHandler } from "@qwik.dev/router";
import { routeLoader$ } from "@qwik.dev/router";
import { requireAdmin } from "~/utils/server-auth";

export const onGet: RequestHandler = ({ cacheControl }) => {
  cacheControl({ noCache: true });
};

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
