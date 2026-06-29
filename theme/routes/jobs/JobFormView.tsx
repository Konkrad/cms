import { component$, useSignal, $ } from "@qwik.dev/core";
import { Button } from "~/components/ui/Button";
import { Input } from "~/components/ui/Input";
import { Select } from "~/components/ui/Select";
import { BlockNoteEditor } from "~/components/editor";
import type { JobFormAction } from "~/contracts/jobs";

export type JobFormInitialValues = {
  title: string;
  editorState: string | null;
  body: string;
  locationType: "on-site" | "remote-eu" | "remote-country";
  city: string;
  country: string;
  link: string;
  posterRelation: string;
  /** yyyy-mm-dd */
  expiresAt: string;
};

/** Shared themed form for posting (`/jobs/new`) and editing (`/jobs/mine/[id]/edit`) a job. */
export const JobFormView = component$<{
  mode: "new" | "edit";
  backHref: string;
  backLabel: string;
  heading: string;
  initial: JobFormInitialValues;
  maxDateStr: string;
  cancelHref: string;
  submitLabel: string;
  submittingLabel: string;
  action: JobFormAction;
}>(({ mode, backHref, backLabel, heading, initial, maxDateStr, cancelHref, submitLabel, submittingLabel, action }) => {
  const isSubmitting = useSignal(false);
  const locationType = useSignal(initial.locationType);
  const body = useSignal(initial.body);
  const editorState = useSignal(initial.editorState ?? "");

  const handleEditorChange$ = $((html: string, state: string) => {
    body.value = html;
    editorState.value = state;
  });

  return (
    <div class="max-w-2xl mx-auto px-4 py-8">
      <div class="mb-6">
        <a href={backHref} class="text-sm text-blue-600 hover:text-blue-800">
          ← {backLabel}
        </a>
      </div>

      <h1 class="text-2xl font-bold text-gray-900 mb-6">{heading}</h1>

      {action.value?.failed && action.value?.error && (
        <div class="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {action.value.error}
        </div>
      )}

      <div class="bg-white border border-gray-200 rounded-lg p-6">
        <form
          preventdefault:submit
          onSubmit$={() => {
            isSubmitting.value = true;
            const form = document.querySelector("form") as HTMLFormElement;
            if (form) action.submit(new FormData(form));
          }}
          class="space-y-6"
        >
          <Input
            name="title"
            label="Job Title"
            required
            value={initial.title}
            placeholder="e.g. Senior Frontend Engineer"
          />

          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">
              Job Description <span class="text-red-500">*</span>
            </label>
            <div class="border border-gray-300 rounded-lg overflow-hidden">
              <BlockNoteEditor
                editorState={initial.editorState}
                content={initial.body || undefined}
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
            value={initial.locationType}
            onChange$={(e) => {
              locationType.value = (e.target as HTMLSelectElement).value as any;
            }}
          >
            <option value="on-site">On-site / Hybrid</option>
            <option value="remote-eu">Remote — EU only</option>
            <option value="remote-country">Remote — specific country</option>
          </Select>

          {locationType.value === "on-site" && (
            <Input name="city" label="City" value={initial.city} placeholder="e.g. Berlin" />
          )}

          {(locationType.value === "on-site" ||
            locationType.value === "remote-country") && (
            <Input name="country" label="Country" value={initial.country} placeholder="e.g. Germany" />
          )}

          <Input
            name="link"
            label="Application link (optional)"
            type="url"
            value={initial.link}
            placeholder="https://..."
          />

          <Select
            name="posterRelation"
            label="Your relation to this position (optional)"
            value={initial.posterRelation}
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
            value={initial.expiresAt}
            max={maxDateStr}
          />

          {action.value?.failed && !action.value?.error && (
            <div class="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-sm">
              Please check the form for errors.
            </div>
          )}

          <div class="flex gap-4">
            <Button type="submit" disabled={isSubmitting.value}>
              {isSubmitting.value ? submittingLabel : submitLabel}
            </Button>
            <Button href={cancelHref} variant="secondary">
              Cancel
            </Button>
          </div>
        </form>

        {mode === "new" && (
          <p class="mt-4 text-sm text-gray-500">
            Your listing will be reviewed before it appears publicly.
          </p>
        )}
      </div>
    </div>
  );
});
