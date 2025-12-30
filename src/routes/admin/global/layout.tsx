import { component$, Slot } from "@builder.io/qwik";
import { routeLoader$ } from "@builder.io/qwik-city";
import { AdminNav } from "~/components/admin/AdminNav";
import { Breadcrumbs } from "~/components/admin/Breadcrumbs";
import { getCurrentUserData } from "~/utils/server-auth";

export const useGlobalAdminAuth = routeLoader$(async (event) => {
  const user = await getCurrentUserData(event);

  // Check if user is platform admin
  if (!user || user.role !== "admin") {
    throw event.redirect(302, "/");
  }

  return { user };
});

export default component$(() => {
  const auth = useGlobalAdminAuth();

  return (
    <div class="min-h-screen bg-gray-50">
      <div class="bg-slate-800 text-white shadow-lg">
        <div class="max-w-7xl mx-auto px-4 py-6">
          <div class="flex items-center justify-between mb-4">
            <h1 class="text-3xl font-bold">Platform Admin</h1>
            <a
              href="/"
              class="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded transition-colors text-sm"
            >
              Back to Site
            </a>
          </div>
          <AdminNav isGlobal={true} />
        </div>
      </div>
      <div class="max-w-7xl mx-auto px-4 py-8">
        <Breadcrumbs />
        <Slot />
      </div>
    </div>
  );
});
