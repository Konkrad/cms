import { component$, useSignal, $ } from "@qwik.dev/core";
import { routeAction$, routeLoader$, z, zod$ } from "@qwik.dev/router";
import { Button } from "~/components/ui/Button";
import { Input } from "~/components/ui/Input";
import { Select } from "~/components/ui/Select";
import { BlockNoteEditor } from "~/components/editor";
import { jobsService } from "~/services/jobs.service";

export const useJob = routeLoader$(async (event) => {
  const { requireAdmin } = await import("~/utils/server-auth");
  await requireAdmin(event);
  const job = await jobsService.getById(event.params.id);
  if (!job) throw event.redirect(302, "/admin/global/jobs");
  return { job };
});

export const useUpdateJob = routeAction$(
  async (data, event) => {
    const { requireAdmin } = await import("~/utils/server-auth");
    await requireAdmin(event);

    await jobsService.update(event.params.id, {
      title: data.title,
      body: data.body,
      editorState: data.editorState || null,
      locationType: data.locationType as "on-site" | "remote-eu" | "remote-country",
      city: data.city || null,
      country: data.country || null,
      link: data.link || null,
      posterRelation: data.posterRelation || null,
      expiresAt: new Date(data.expiresAt),
      status: data.status as "pending" | "approved",
    } as any);

    throw event.redirect(303, "/admin/global/jobs");
  },
  zod$({
    title: z.string().min(1, "Title is required"),
    body: z.string(),
    editorState: z.string().optional(),
    locationType: z.enum(["on-site", "remote-eu", "remote-country"]),
    city: z.string().optional(),
    country: z.string().optional(),
    link: z.string().optional(),
    posterRelation: z.enum(["hiring", "founder", "direct-team", "works-there", "other"]).optional(),
    expiresAt: z.string().min(1, "Expiry date is required"),
    status: z.enum(["pending", "approved"]),
  }),
);

export default component$(() => {
  const data = useJob();
  const updateAction = useUpdateJob();
  const job = data.value.job;

  const body = useSignal(job.body ?? "");
  const editorState = useSignal(job.editorState ?? "");
  const locationType = useSignal(job.locationType);

  const handleEditorChange$ = $((html: string, state: string) => {
    body.value = html;
    editorState.value = state;
  });

  return (
    <div>
      <div class="flex items-center justify-between mb-6">
        <h2 class="text-2xl font-bold text-gray-800">Edit Job</h2>
        <Button href="/admin/global/jobs" variant="secondary">
          Back to Jobs
        </Button>
      </div>

      <div class="bg-white rounded-lg shadow-sm p-6">
        <form
          preventdefault:submit
          onSubmit$={() => {
            const form = document.querySelector("form") as HTMLFormElement;
            if (form) updateAction.submit(new FormData(form));
          }}
          class="space-y-6"
        >
          <Input name="title" label="Title" required value={job.title} />

          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">
              Description
            </label>
            <div class="border border-gray-300 rounded-lg overflow-hidden">
              <BlockNoteEditor
                editorState={job.editorState ?? null}
                content={job.body}
                onChange$={handleEditorChange$}
                textOnly
              />
            </div>
          </div>
          <input type="hidden" name="body" value={body.value} />
          <input type="hidden" name="editorState" value={editorState.value} />

          <Select
            name="locationType"
            label="Location Type"
            value={job.locationType}
            onChange$={(e) => {
              locationType.value = (e.target as HTMLSelectElement).value as any;
            }}
          >
            <option value="on-site">On-site / Hybrid</option>
            <option value="remote-eu">Remote — EU</option>
            <option value="remote-country">Remote — specific country</option>
          </Select>

          {locationType.value === "on-site" && (
            <Input name="city" label="City" value={job.city ?? ""} />
          )}

          {(locationType.value === "on-site" || locationType.value === "remote-country") && (
            <Input name="country" label="Country" value={job.country ?? ""} />
          )}

          <Input
            name="link"
            label="Application link / CTA (optional)"
            type="url"
            value={job.link ?? ""}
            placeholder="https://..."
          />

          <Select
            name="posterRelation"
            label="Poster's relation to the position"
            value={job.posterRelation ?? ""}
          >
            <option value="">— not specified —</option>
            <option value="hiring">Hiring for this role</option>
            <option value="founder">Founder</option>
            <option value="direct-team">Direct team</option>
            <option value="works-there">Works there</option>
            <option value="other">Other</option>
          </Select>

          <Input
            name="expiresAt"
            label="Expires on"
            type="date"
            required
            value={job.expiresAt.slice(0, 10)}
          />

          <Select name="status" label="Status" value={job.status}>
            <option value="pending">Pending review</option>
            <option value="approved">Approved</option>
          </Select>

          {updateAction.value?.failed && (
            <div class="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-sm">
              Failed to update job. Please check the form.
            </div>
          )}

          <div class="flex gap-4">
            <Button type="submit">Save Changes</Button>
            <Button href="/admin/global/jobs" variant="secondary">
              Cancel
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
});
