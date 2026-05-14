import { component$ } from "@qwik.dev/core";
import {
  Form,
  routeAction$,
  routeLoader$,
  zod$,
  z,
} from "@qwik.dev/router";
import { Button } from "~/components/ui/Button";
import { Card } from "~/components/ui/Card";
import { Input } from "~/components/ui/Input";
import { Select } from "~/components/ui/Select";
import { pagesService } from "~/services/pages.service";
import { menuItemsService } from "~/services/menu-items.service";
import { requireAdmin } from "~/utils/server-auth";

// Pages are only accessible in global context
export const useCheckGlobalContext = routeLoader$(
  async ({ params, redirect }) => {
    if (params.group_slug !== "global") {
      throw redirect(302, `/admin/${params.group_slug}`);
    }
    return true;
  },
);

export const useAdminAuth = routeLoader$(async (event) => {
  await requireAdmin(event);
  return true;
});

export const useCreatePage = routeAction$(
  async (data, event) => {
    await requireAdmin(event);

    try {
      const normalizedUrl = data.url.trim().startsWith("/") ? data.url.trim() : `/${data.url.trim()}`;
      const menuName = data.menuName as "main" | "footer";

      // Reject if the URL is already taken in any menu
      const allItems = await menuItemsService.getAll(undefined, { includeHidden: true });
      const duplicate = allItems.find((item) => item.url === normalizedUrl);
      if (duplicate) {
        return { success: false, error: `The URL "${normalizedUrl}" is already in use by another menu item.` };
      }

      // Create the page first
      const page = await pagesService.create({
        status: (data.status as "draft" | "published") || "draft",
        content: [],
      });

      const existing = await menuItemsService.getAll(menuName, { includeHidden: true });
      const maxPosition = existing.reduce((max, item) => Math.max(max, item.position), -1);
      await menuItemsService.create({
        menuName,
        title: data.title,
        url: normalizedUrl,
        pageId: page.id,
        parentId: null,
        position: maxPosition + 1,
        status: "hidden",
        icon: null,
        target: "_self",
      });

      throw event.redirect(303, `/admin/global/pages/${page.id}/builder`);
    } catch (err: any) {
      if (err?.status === 303) throw err;
      return { success: false, error: err?.message || "Failed to create page" };
    }
  },
  zod$({
    title: z.string().min(1, "Title is required"),
    url: z.string().min(1, "URL is required"),
    menuName: z.enum(["main", "footer"]).default("main"),
    status: z.enum(["draft", "published"]).default("draft"),
  }),
);

export default component$(() => {
  const action = useCreatePage();

  return (
    <div class="max-w-2xl mx-auto px-4 py-8">
      <h1 class="text-3xl font-bold text-gray-900 mb-8">Create New Page</h1>

      {action.value?.error && (
        <div class="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded-sm">
          {action.value.error}
        </div>
      )}

      <Card>
        <Form action={action} class="space-y-6">
          <Input
            name="title"
            label="Page Title"
            required
            value={action.formData?.get("title")}
            error={action.value?.fieldErrors?.title?.[0]}
            placeholder="About Us"
          />

          <div>
            <Input
              name="url"
              label="URL"
              required
              value={action.formData?.get("url")}
              error={action.value?.fieldErrors?.url?.[0]}
              placeholder="/about-us"
            />
            <p class="mt-1 text-sm text-gray-500">
              The URL path for this page (e.g. /about-us) or an external URL.
            </p>
          </div>

          <Select
            name="menuName"
            label="Menu"
            value={(action.formData?.get("menuName") as string) || "main"}
            error={action.value?.fieldErrors?.menuName?.[0]}
          >
            <option value="main">Main</option>
            <option value="footer">Footer</option>
          </Select>

          <Select
            name="status"
            label="Status"
            required
            value={(action.formData?.get("status") as string) || "draft"}
            error={action.value?.fieldErrors?.status?.[0]}
          >
            <option value="draft">Draft</option>
            <option value="published">Published</option>
          </Select>

          <div class="flex gap-4">
            <Button type="submit" disabled={action.isRunning}>
              {action.isRunning ? "Creating..." : "Create Page"}
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick$={() => window.history.back()}
            >
              Cancel
            </Button>
          </div>
        </Form>
      </Card>
    </div>
  );
});
