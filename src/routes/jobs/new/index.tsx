import { component$, useSignal, $ } from "@qwik.dev/core";
import { routeAction$, routeLoader$, z, zod$ } from "@qwik.dev/router";
import { Button } from "~/components/ui/Button";
import { Input } from "~/components/ui/Input";
import { Select } from "~/components/ui/Select";
import { BlockNoteEditor } from "~/components/editor";
import { jobsService } from "~/services/jobs.service";

export const useCurrentUser = routeLoader$(async (event) => {
  const { requireAuth } = await import("~/utils/server-auth");
  const user = await requireAuth(event);
  return { user };
});

const MAX_DAYS = 30;

export const useSubmitJob = routeAction$(
  async (data, event) => {
    const { requireAuth } = await import("~/utils/server-auth");
    const user = await requireAuth(event);

    const expiresAt = new Date(data.expiresAt);
    const maxExpiry = new Date();
    maxExpiry.setDate(maxExpiry.getDate() + MAX_DAYS);

    if (expiresAt > maxExpiry) {
      return { failed: true, error: "Expiry date cannot be more than 30 days from today." };
    }

    await jobsService.create({
      title: data.title,
      body: data.body,
      editorState: data.editorState || null,
      locationType: data.locationType as "on-site" | "remote-eu" | "remote-country",
      city: data.city || null,
      country: data.country || null,
      link: data.link || null,
      posterRelation: data.posterRelation || null,
      expiresAt,
      status: "pending",
      suggestedBy: user.id,
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
    posterRelation: z.enum(["hiring", "founder", "direct-team", "works-there", "other"]).optional(),
    expiresAt: z.string().min(1, "Expiry date is required"),
  }),
);

export default component$(() => {
  useCurrentUser();
  const submitAction = useSubmitJob();
  const isSubmitting = useSignal(false);
  const locationType = useSignal<"on-site" | "remote-eu" | "remote-country">("on-site");
  const body = useSignal("");
  const editorState = useSignal("");

  const handleEditorChange$ = $((html: string, state: string) => {
    body.value = html;
    editorState.value = state;
  });

  const maxDate = new Date();
  maxDate.setDate(maxDate.getDate() + 30);
  const maxDateStr = maxDate.toISOString().slice(0, 10);
  const defaultExpiry = maxDateStr;

  return (
    <div class="max-w-2xl mx-auto px-4 py-8">
      <div class="mb-6">
        <a href="/jobs" class="text-sm text-blue-600 hover:text-blue-800">
          ← Back to Job Board
        </a>
      </div>

      <h1 class="text-2xl font-bold text-gray-900 mb-6">Post a Job</h1>

      {submitAction.value?.failed && submitAction.value?.error && (
        <div class="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {submitAction.value.error}
        </div>
      )}

      <div class="bg-white border border-gray-200 rounded-lg p-6">
        <form
          preventdefault:submit
          onSubmit$={() => {
            isSubmitting.value = true;
            const form = document.querySelector("form") as HTMLFormElement;
            if (form) submitAction.submit(new FormData(form));
          }}
          class="space-y-6"
        >
          <Input
            name="title"
            label="Job Title"
            required
            placeholder="e.g. Senior Frontend Engineer"
          />

          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">
              Job Description <span class="text-red-500">*</span>
            </label>
            <div class="border border-gray-300 rounded-lg overflow-hidden">
              <BlockNoteEditor
                editorState={null}
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
            value="on-site"
            onChange$={(e) => {
              locationType.value = (e.target as HTMLSelectElement).value as any;
            }}
          >
            <option value="on-site">On-site / Hybrid</option>
            <option value="remote-eu">Remote — EU only</option>
            <option value="remote-country">Remote — specific country</option>
          </Select>

          {locationType.value === "on-site" && (
            <Input name="city" label="City" placeholder="e.g. Berlin" />
          )}

          {(locationType.value === "on-site" || locationType.value === "remote-country") && (
            <Input name="country" label="Country" placeholder="e.g. Germany" />
          )}

          <Input
            name="link"
            label="Application link (optional)"
            type="url"
            placeholder="https://..."
          />

          <Select name="posterRelation" label="Your relation to this position (optional)">
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
            value={defaultExpiry}
            max={maxDateStr}
          />

          {submitAction.value?.failed && !submitAction.value?.error && (
            <div class="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-sm">
              Please check the form for errors.
            </div>
          )}

          <div class="flex gap-4">
            <Button type="submit" disabled={isSubmitting.value}>
              {isSubmitting.value ? "Submitting…" : "Submit for Review"}
            </Button>
            <Button href="/jobs" variant="secondary">
              Cancel
            </Button>
          </div>
        </form>

        <p class="mt-4 text-sm text-gray-500">
          Your listing will be reviewed before it appears publicly.
        </p>
      </div>
    </div>
  );
});
