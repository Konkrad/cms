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

export const usePage = routeLoader$(async ({ params }) => {
  const page = await pagesService.getById(params.id);
  if (!page) {
    throw new Error("Page not found");
  }
  return page;
});

export const useUpdatePage = routeAction$(
  async (data, event) => {
    await requireAdmin(event);

    try {
      const page = await pagesService.getById(event.params.id);
      if (!page) return { success: false, error: "Page not found" };

      // Update the linked menu item's title, url and visibility if one exists
      if (page.menuItem) {
        await menuItemsService.update(page.menuItem.id, {
          title: data.title,
          url: data.url,
          status: data.visibility as "visible" | "hidden",
        });
      }

      // Update the page's publication status
      await pagesService.update(event.params.id, {
        status: data.pageStatus as "draft" | "published",
      });

      throw event.redirect(303, "/admin/global/pages");
    } catch (err: any) {
      if (err?.status === 303) throw err;
      return { success: false, error: err?.message || "Failed to update page" };
    }
  },
  zod$({
    title: z.string().min(1, "Title is required"),
    url: z.string().min(1, "URL is required"),
    pageStatus: z.enum(["draft", "published"]).default("draft"),
    visibility: z.enum(["visible", "hidden"]).default("hidden"),
  }),
);

export default component$(() => {
  const page = usePage();
  const action = useUpdatePage();

  const pageStatus = (action.formData?.get("pageStatus") as string) || page.value.status || "draft";
  const visibility = (action.formData?.get("visibility") as string) || page.value.menuItem?.status || "hidden";

  return (
    <div class="max-w-2xl mx-auto px-4 py-8">
      <h1 class="text-3xl font-bold text-gray-900 mb-8">Edit Page Info</h1>

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
            value={action.formData?.get("title") || page.value.menuItem?.title || ""}
            error={action.value?.fieldErrors?.title?.[0]}
          />

          <div>
            <Input
              name="url"
              label="URL"
              required
              value={action.formData?.get("url") || page.value.menuItem?.url || ""}
              error={action.value?.fieldErrors?.url?.[0]}
            />
            <p class="mt-1 text-sm text-gray-500">
              The URL path for this page (e.g. /about-us) or an external URL.
            </p>
          </div>

          <Select
            name="pageStatus"
            label="Page Status"
            required
            error={action.value?.fieldErrors?.pageStatus?.[0]}
          >
            <option value="draft" selected={pageStatus === "draft"}>Draft — page is not publicly accessible</option>
            <option value="published" selected={pageStatus === "published"}>Published — page is publicly accessible</option>
          </Select>

          <Select
            name="visibility"
            label="Menu Visibility"
            required
            error={action.value?.fieldErrors?.visibility?.[0]}
          >
            <option value="visible" selected={visibility === "visible"}>Visible — shown in navigation</option>
            <option value="hidden" selected={visibility === "hidden"}>Hidden — not shown in navigation</option>
          </Select>

          <div class="flex gap-4">
            <Button type="submit" disabled={action.isRunning}>
              {action.isRunning ? "Updating..." : "Update Page"}
            </Button>
            <Button href="/admin/global/pages" variant="secondary">
              Cancel
            </Button>
          </div>
        </Form>
      </Card>
    </div>
  );
});
