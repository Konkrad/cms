import { component$, useSignal, $ } from "@qwik.dev/core";
import { routeAction$, routeLoader$, z, zod$ } from "@qwik.dev/router";
import { Button } from "~/components/ui/Button";
import { Input } from "~/components/ui/Input";
import { Select } from "~/components/ui/Select";
import { BlockNoteEditor } from "~/components/editor";
import { jobsService } from "~/services/jobs.service";

export const useJob = routeLoader$(async (event) => {
  const { requireAuth } = await import("~/utils/server-auth");
  const user = await requireAuth(event);

  const job = await jobsService.getById(event.params.id);

  if (!job || job.suggestedBy !== user.id) {
    throw event.redirect(302, "/jobs/mine");
  }
  if (job.status !== "pending") {
    throw event.redirect(302, "/jobs/mine");
  }

  return { job };
});

const MAX_DAYS = 30;

export const useUpdateMyJob = routeAction$(
  async (data, event) => {
    const { requireAuth } = await import("~/utils/server-auth");
    const user = await requireAuth(event);

    const job = await jobsService.getById(event.params.id);
    if (!job || job.suggestedBy !== user.id || job.status !== "pending") {
      return { failed: true, error: "Not allowed." };
    }

    const expiresAt = new Date(data.expiresAt);
    const maxExpiry = new Date();
    maxExpiry.setDate(maxExpiry.getDate() + MAX_DAYS);

    if (expiresAt > maxExpiry) {
      return {
        failed: true,
        error: "Expiry date cannot be more than 30 days from today.",
      };
    }

    await jobsService.update(event.params.id, {
      title: data.title,
      body: data.body,
      editorState: data.editorState || null,
      locationType: data.locationType as
        | "on-site"
        | "remote-eu"
        | "remote-country",
      city: data.city || null,
      country: data.country || null,
      link: data.link || null,
      posterRelation: data.posterRelation || null,
      expiresAt,
    } as any);

    throw event.redirect(303, "/jobs/mine");
  },
  zod$({
    title: z.string().min(1, "Title is required"),
    body: z.string(),
    editorState: z.string().optional(),
    locationType: z.enum(["on-site", "remote-eu", "remote-country"]),
    city: z.string().optional(),
    country: z.string().optional(),
    link: z.string().optional(),
    posterRelation: z
      .enum(["hiring", "founder", "direct-team", "works-there", "other"])
      .optional(),
    expiresAt: z.string().min(1, "Expiry date is required"),
  }),
);

export default component$(() => {
  const data = useJob();
  const updateAction = useUpdateMyJob();
  const job = data.value.job;

  const body = useSignal(job.body ?? "");
  const editorState = useSignal(job.editorState ?? "");
  const locationType = useSignal(job.locationType);
  const isSubmitting = useSignal(false);

  const handleEditorChange$ = $((html: string, state: string) => {
    body.value = html;
    editorState.value = state;
  });

  const maxDate = new Date();
  maxDate.setDate(maxDate.getDate() + 30);
  const maxDateStr = maxDate.toISOString().slice(0, 10);

  return (
    <div class="max-w-2xl mx-auto px-4 py-8">
      <div class="mb-6">
        <a href="/jobs/mine" class="text-sm text-blue-600 hover:text-blue-800">
          ← Back to My Submissions
        </a>
      </div>

      <h1 class="text-2xl font-bold text-gray-900 mb-6">Edit Job Posting</h1>

      {updateAction.value?.failed && updateAction.value?.error && (
        <div class="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {updateAction.value.error}
        </div>
      )}

      <div class="bg-white border border-gray-200 rounded-lg p-6">
        <form
          preventdefault:submit
          onSubmit$={() => {
            isSubmitting.value = true;
            const form = document.querySelector("form") as HTMLFormElement;
            if (form) updateAction.submit(new FormData(form));
          }}
          class="space-y-6"
        >
          <Input name="title" label="Job Title" required value={job.title} />

          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">
              Job Description <span class="text-red-500">*</span>
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
            label="Location"
            value={job.locationType}
            onChange$={(e) => {
              locationType.value = (e.target as HTMLSelectElement).value as any;
            }}
          >
            <option value="on-site">On-site / Hybrid</option>
            <option value="remote-eu">Remote — EU only</option>
            <option value="remote-country">Remote — specific country</option>
          </Select>

          {locationType.value === "on-site" && (
            <Input name="city" label="City" value={job.city ?? ""} />
          )}

          {(locationType.value === "on-site" ||
            locationType.value === "remote-country") && (
            <Input name="country" label="Country" value={job.country ?? ""} />
          )}

          <Input
            name="link"
            label="Application link (optional)"
            type="url"
            value={job.link ?? ""}
            placeholder="https://..."
          />

          <Select
            name="posterRelation"
            label="Your relation to this position (optional)"
            value={job.posterRelation ?? ""}
          >
            <option value="">— select —</option>
            <option value="hiring">I'm hiring for this role</option>
            <option value="founder">I'm the founder</option>
            <option value="direct-team">You'd be on my team</option>
            <option value="works-there">I work there</option>
            <option value="other">Other</option>
          </Select>

          <Input
            name="expiresAt"
            label="Listing expires on"
            type="date"
            required
            value={job.expiresAt.slice(0, 10)}
            max={maxDateStr}
          />

          {updateAction.value?.failed && !updateAction.value?.error && (
            <div class="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-sm">
              Please check the form for errors.
            </div>
          )}

          <div class="flex gap-4">
            <Button type="submit" disabled={isSubmitting.value}>
              {isSubmitting.value ? "Saving…" : "Save Changes"}
            </Button>
            <Button href="/jobs/mine" variant="secondary">
              Cancel
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
});
