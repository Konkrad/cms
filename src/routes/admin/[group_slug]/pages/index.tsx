import { component$ } from "@builder.io/qwik";
import {
  Form,
  Link,
  routeAction$,
  routeLoader$,
  z,
  zod$,
} from "@builder.io/qwik-city";
import { AdminTable } from "~/components/ui/AdminTable";
import { Button } from "~/components/ui/Button";
import { menuItemsService } from "~/services/menu-items.service";
import { pagesService } from "~/services/pages.service";
import { requireAdmin } from "~/utils/server-auth";
import { format } from "date-fns";

// Pages are only accessible in global context
export const useCheckGlobalContext = routeLoader$(async ({ params, redirect }) => {
  if (params.group_slug !== "global") {
    throw redirect(302, `/admin/${params.group_slug}`);
  }
  return true;
});

export const useAdminAuth = routeLoader$(async (event) => {
  await requireAdmin(event);
  return true;
});

export const usePages = routeLoader$(async () => {
  const result = await pagesService.getAll();
  return result.items;
});

export const useMenuItems = routeLoader$(async () => {
  const result = await menuItemsService.getAll("main");
  return result;
});

export const useDeletePage = routeAction$(
  async (data, event) => {
    await requireAdmin(event);

    const accessToken = event.cookie.get("sb-access-token")?.value;
    const refreshToken = event.cookie.get("sb-refresh-token")?.value;

    try {
      await pagesService.delete(data.pageId);
      return { success: true };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || "Failed to delete page",
      };
    }
  },
  zod$({
    pageId: z.string(),
  }),
);

export const useAddToMenu = routeAction$(
  async (data, event) => {
    await requireAdmin(event);

    const accessToken = event.cookie.get("sb-access-token")?.value;
    const refreshToken = event.cookie.get("sb-refresh-token")?.value;

    try {
      const page = await pagesService.getById(data.pageId);
      if (!page) {
        return { success: false, error: "Page not found" };
      }

      const menuItems = await menuItemsService.getAll("main");
      const maxPosition = menuItems.reduce(
        (max, item) => Math.max(max, item.position),
        0,
      );

      await menuItemsService.create({
        menuName: "main",
        label: page.title,
        url: `${page.slug}`,
        parentId: null,
        position: maxPosition + 1,
        icon: null,
        target: "_self",
      });

      return { success: true };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || "Failed to add page to menu",
      };
    }
  },
  zod$({
    pageId: z.string(),
  }),
);

export default component$(() => {
  const pages = usePages();
  const menuItems = useMenuItems();
  const deletePageAction = useDeletePage();
  const addToMenuAction = useAddToMenu();

  const isPageInMenu = (pageId: string) => {
    const page = pages.value.find((p) => p.id === pageId);
    if (!page) return false;
    return menuItems.value.some((item) => item.url === `${page.slug}`);
  };

  return (
    <div>
      <div class="flex justify-between items-center mb-6">
        <h2 class="text-2xl font-bold">Manage Pages</h2>
        <Button href="/admin/global/pages/new" variant="primary">Create New Page</Button>
      </div>

      {deletePageAction.value?.success && (
        <div class="mb-4 p-3 bg-green-100 border border-green-400 text-green-700 rounded">
          Page deleted successfully
        </div>
      )}

      {deletePageAction.value?.error && (
        <div class="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
          {deletePageAction.value.error}
        </div>
      )}

      {addToMenuAction.value?.success && (
        <div class="mb-4 p-3 bg-green-100 border border-green-400 text-green-700 rounded">
          Page added to menu successfully
        </div>
      )}

      {addToMenuAction.value?.error && (
        <div class="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
          {addToMenuAction.value.error}
        </div>
      )}

      <AdminTable>
            <thead class="bg-gray-50">
              <tr>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Title
                </th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Slug
                </th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Parent
                </th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Created
                </th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody class="bg-white divide-y divide-gray-200">
              {pages.value.map((page) => (
                <tr key={page.id}>
                  <td class="px-6 py-4">
                    <div class="max-w-xs truncate font-medium">
                      {page.title}
                    </div>
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap">
                    <code class="text-sm bg-gray-100 px-2 py-1 rounded">
                      {page.slug}
                    </code>
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {page.parent?.title || "-"}
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap">
                    <span
                      class={`px-2 py-1 text-xs font-medium rounded-full ${
                        page.status === "published"
                          ? "bg-green-100 text-green-800"
                          : "bg-yellow-100 text-yellow-800"
                      }`}
                    >
                      {page.status}
                    </span>
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {format(new Date(page.createdAt), "MMM d, yyyy")}
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm">
                    <div class="flex gap-2 flex-wrap">
                      {page.status === "published" && (
                        <Link
                          href={`${page.slug}`}
                          class="text-blue-600 hover:text-blue-900"
                        >
                          View
                        </Link>
                      )}
                      <a
                        href={`/admin/global/pages/${page.id}/edit`}
                        class="text-green-600 hover:text-green-900"
                      >
                        Edit
                      </a>
                      <a
                        href={`/admin/global/pages/${page.id}/builder`}
                        class="text-purple-600 hover:text-purple-900"
                      >
                        Builder
                      </a>
                      {!isPageInMenu(page.id) &&
                        page.status === "published" && (
                          <Form action={addToMenuAction} class="inline">
                            <input
                              type="hidden"
                              name="pageId"
                              value={page.id}
                            />
                            <button
                              type="submit"
                              class="text-indigo-600 hover:text-indigo-900"
                            >
                              Add to Menu
                            </button>
                          </Form>
                        )}
                      {isPageInMenu(page.id) && (
                        <span class="text-gray-400">In Menu</span>
                      )}
                      <Form action={deletePageAction} class="inline">
                        <input type="hidden" name="pageId" value={page.id} />
                        <button
                          type="submit"
                          class="text-red-600 hover:text-red-900"
                          onClick$={(e) => {
                            if (
                              !confirm(
                                "Are you sure you want to delete this page?",
                              )
                            ) {
                              e.preventDefault();
                            }
                          }}
                        >
                          Delete
                        </button>
                      </Form>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
      </AdminTable>
    </div>
  );
});
