import { component$, useSignal, $ } from "@qwik.dev/core";
import { routeAction$, routeLoader$, z, zod$ } from "@qwik.dev/router";
import { Button } from "~/components/ui/Button";
import { Input } from "~/components/ui/Input";
import { TextArea } from "~/components/ui/TextArea";
import { ImageUploader } from "~/components/ui/ImageUploader/ImageUploader";
import { StepsEditor } from "~/components/admin/StepsEditor/StepsEditor";
import { dealsService } from "~/services/deals.service";

export const useGlobalOnly = routeLoader$(async ({ params, redirect }) => {
  if (params.group_slug !== "global") {
    throw redirect(302, "/admin/global/deals");
  }
  return {};
});

export const useCreateDeal = routeAction$(
  async (data, event) => {
    const { requireAdmin } = await import("~/utils/server-auth");
    await requireAdmin(event);

    const steps = JSON.parse(data.steps || "[]");

    await dealsService.create({
      name: data.name,
      description: data.description || null,
      logo: data.logo || null,
      validUntil: data.validUntil
        ? new Date(data.validUntil).toISOString()
        : null,
      steps,
    } as any);

    throw event.redirect(303, "/admin/global/deals");
  },
  zod$({
    name: z.string().min(1, "Name is required"),
    description: z.string().optional(),
    logo: z.string().optional(),
    validUntil: z.string().optional(),
    steps: z.string().default("[]"),
  }),
);

export default component$(() => {
  useGlobalOnly();
  const createAction = useCreateDeal();
  const isSubmitting = useSignal(false);
  const triggerUpload = useSignal(false);

  const handleSubmit = $(() => {
    isSubmitting.value = true;
    triggerUpload.value = true;
  });

  const onUploadSettled = $(() => {
    const form = document.querySelector("form") as HTMLFormElement | null;
    if (form) createAction.submit(new FormData(form));
  });

  return (
    <div>
      <div class="flex items-center justify-between mb-6">
        <h2 class="text-2xl font-bold text-gray-800">Add Deal</h2>
        <Button href="/admin/global/deals" variant="secondary">
          Back to Deals
        </Button>
      </div>

      <div class="bg-white rounded-lg shadow-sm p-6">
        <form preventdefault:submit onSubmit$={handleSubmit} class="space-y-6">
          <Input name="name" label="Name" required placeholder="Deal name" />

          <TextArea
            name="description"
            label="Description"
            rows={3}
            placeholder="Brief description of this deal"
          />

          <div>
            <p class="text-sm font-medium text-gray-700 mb-1">
              Logo (SVG, optional)
            </p>
            <ImageUploader
              name="logo"
              path="public/deals/logos"
              pipeline="svg"
              triggerSignal={triggerUpload}
              onSettled$={onUploadSettled}
              aspectRatio="1/1"
            />
          </div>

          <Input
            name="validUntil"
            label="Valid Until (optional)"
            type="date"
          />

          <div>
            <p class="text-sm font-medium text-gray-700 mb-2">Steps</p>
            <StepsEditor />
          </div>

          {createAction.value?.failed && (
            <div class="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-sm">
              Failed to create deal. Please check the form.
            </div>
          )}

          <div class="flex gap-4">
            <Button type="submit" disabled={isSubmitting.value}>
              {isSubmitting.value ? "Saving…" : "Create Deal"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
});
