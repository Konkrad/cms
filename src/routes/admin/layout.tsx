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
    // `.admin-shell` pins token VALUES so the (un-themeable) admin panel is
    // isolated from the active theme's brand colors. See src/global.css.
    <div class="admin-shell min-h-screen bg-gray-50">
      <div class="max-w-7xl mx-auto px-4 py-8">
        <Slot />
      </div>
    </div>
  );
});
