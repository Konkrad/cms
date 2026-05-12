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

export const usePages = routeLoader$(async () => {
  const res = await pagesService.getAll();
  return res.items;
});

export const useCreatePage = routeAction$(
  async (data, event) => {
    await requireAdmin(event);

    try {
      const page = await pagesService.create({
        title: data.title,
        slug: data.slug,
        parentId: data.parentId || null,
        status: (data.status as "draft" | "published") || "draft",
        content: [],
      });
      throw event.redirect(303, `/admin/global/pages/${page.id}/builder`);
    } catch (err: any) {
      if (err?.status === 303) throw err;
      return { success: false, error: err?.message || "Failed to create page" };
    }
  },
  zod$({
    title: z.string().min(1, "Title is required"),
    slug: z
      .string()
      .min(1, "Slug is required")
      .regex(
        /^\/?[a-z0-9-]+(\/[a-z0-9-]+)*$|^\/$/,
        'Slug must be "/" for home page, or a path of lowercase letters, numbers, and hyphens (e.g. "groups" or "/groups/subpage")',
      ),
    parentId: z.string().optional(),
    status: z.enum(["draft", "published"]).default("draft"),
  }),
);

export default component$(() => {
  const pages = usePages();
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
              name="slug"
              label="URL Slug"
              required
              value={action.formData?.get("slug")}
              error={action.value?.fieldErrors?.slug?.[0]}
              placeholder="about-us"
            />
            <p class="mt-1 text-sm text-gray-500">
              The URL path for this page. Use "/" for home page, or lowercase
              letters, numbers, and hyphens.
            </p>
          </div>

          <Select
            name="parentId"
            label="Parent Page"
            value={(action.formData?.get("parentId") as string) || ""}
            error={action.value?.fieldErrors?.parentId?.[0]}
          >
            <option value="">None (Top Level)</option>
            {pages.value.map((page) => (
              <option key={page.id} value={page.id}>
                {page.title}
              </option>
            ))}
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
