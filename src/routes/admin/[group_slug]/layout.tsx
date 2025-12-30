import { component$, Slot } from "@builder.io/qwik";
import { routeLoader$ } from "@builder.io/qwik-city";
import { AdminNav } from "~/components/admin/AdminNav";
import { Breadcrumbs } from "~/components/admin/Breadcrumbs";
import { getCurrentUserData } from "~/utils/server-auth";
import { groupsService } from "~/services/groups.service";
import { canManageGroupContent } from "~/utils/access-control";

export const useGroupAdminAuth = routeLoader$(async (event) => {
  const { params, sharedMap, redirect } = event;
  const user = await getCurrentUserData(event as any);
  const groupSlug = params.group_slug;

  if (!user) {
    throw redirect(302, "/login");
  }

  // Check if global admin context
  if (groupSlug === "global") {
    // Must be platform admin
    if (user.role !== "admin") {
      throw redirect(302, "/");
    }
    sharedMap.set("adminContext", { isGlobal: true });
    return { user, isGlobal: true, group: null };
  }

  // Group-specific context - must be representative for that group
  const group = await groupsService.getBySlug(groupSlug);
  if (!group) {
    throw redirect(302, "/groups");
  }

  const canManage = await canManageGroupContent(user.id, group.id);
  if (!canManage) {
    throw redirect(302, `/groups/${groupSlug}`);
  }

  sharedMap.set("adminContext", { isGlobal: false, group });
  return { user, isGlobal: false, group };
});

export default component$(() => {
  const auth = useGroupAdminAuth();

  return (
    <div class="min-h-screen bg-gray-50">
      <div class="bg-slate-800 text-white shadow-lg">
        <div class="max-w-7xl mx-auto px-4 py-6">
          <div class="flex items-center justify-between mb-4">
            <div>
              <h1 class="text-3xl font-bold">
                {auth.value.isGlobal
                  ? "Platform Admin"
                  : `${auth.value.group?.name} Admin`}
              </h1>
              {!auth.value.isGlobal && auth.value.group && (
                <p class="text-slate-300 text-sm mt-1">
                  Community Representative Dashboard
                </p>
              )}
            </div>
            <div class="flex gap-3">
              {!auth.value.isGlobal && auth.value.group && (
                <a
                  href={`/groups/${auth.value.group.slug}`}
                  class="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded transition-colors text-sm"
                >
                  View Group
                </a>
              )}
              <a
                href="/"
                class="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded transition-colors text-sm"
              >
                Back to Site
              </a>
            </div>
          </div>
          <AdminNav
            groupSlug={auth.value.isGlobal ? undefined : auth.value.group?.slug}
            isGlobal={auth.value.isGlobal}
          />
        </div>
      </div>
      <div class="max-w-7xl mx-auto px-4 py-8">
        <Breadcrumbs
          groupSlug={auth.value.isGlobal ? undefined : auth.value.group?.slug}
          groupName={auth.value.isGlobal ? undefined : auth.value.group?.name}
        />
        <Slot />
      </div>
    </div>
  );
});
