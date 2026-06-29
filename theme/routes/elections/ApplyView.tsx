import { component$ } from "@qwik.dev/core";
import { Form } from "@qwik.dev/router";
import type { ApplyViewData, SubmitApplicationAction } from "~/contracts/elections";

/** Themed view for the election application form (`/elections/[id]/apply`). */
export const ApplyView = component$<{ data: ApplyViewData; submitAction: SubmitApplicationAction }>(
  ({ data, submitAction }) => {
    const { cycle, position } = data;

    return (
      <div class="max-w-2xl mx-auto px-4 py-8">
        <a href={`/elections/${cycle.id}`} class="text-sm text-gray-500 hover:text-gray-700">
          ← {cycle.title}
        </a>
        <h1 class="text-2xl font-bold text-gray-900 mt-2 mb-1">Apply for {position.title}</h1>
        <p class="text-sm text-gray-500 mb-6">
          Your application will be reviewed by an admin before it is publicly visible.
        </p>

        {submitAction.value?.failed && (
          <div class="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
            {(submitAction.value as any).error ?? "Please fill in all fields (minimum 10 characters each)."}
          </div>
        )}

        <Form action={submitAction} class="space-y-5">
          <input type="hidden" name="positionId" value={position.id} />
          <input type="hidden" name="cycleId" value={cycle.id} />

          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">
              Why do you want this role?
            </label>
            <textarea
              name="motivationWhy"
              rows={4}
              class={`w-full border rounded-md px-3 py-2 text-sm ${(submitAction.value?.fieldErrors as any)?.motivationWhy ? "border-red-400" : ""}`}
            />
            {(submitAction.value?.fieldErrors as any)?.motivationWhy && (
              <p class="text-red-600 text-xs mt-1">{(submitAction.value?.fieldErrors as any).motivationWhy[0]}</p>
            )}
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">
              What relevant experience do you bring?
            </label>
            <textarea
              name="motivationExperience"
              rows={4}
              class={`w-full border rounded-md px-3 py-2 text-sm ${(submitAction.value?.fieldErrors as any)?.motivationExperience ? "border-red-400" : ""}`}
            />
            {(submitAction.value?.fieldErrors as any)?.motivationExperience && (
              <p class="text-red-600 text-xs mt-1">{(submitAction.value?.fieldErrors as any).motivationExperience[0]}</p>
            )}
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">
              What would you like to achieve in this role?
            </label>
            <textarea
              name="motivationGoals"
              rows={4}
              class={`w-full border rounded-md px-3 py-2 text-sm ${(submitAction.value?.fieldErrors as any)?.motivationGoals ? "border-red-400" : ""}`}
            />
            {(submitAction.value?.fieldErrors as any)?.motivationGoals && (
              <p class="text-red-600 text-xs mt-1">{(submitAction.value?.fieldErrors as any).motivationGoals[0]}</p>
            )}
          </div>

          <div class="flex gap-3 pt-2">
            <button
              type="submit"
              class="bg-blue-600 text-white px-5 py-2 rounded-md text-sm font-medium hover:bg-blue-700"
            >
              Submit Application
            </button>
            <a
              href={`/elections/${cycle.id}`}
              class="text-sm text-gray-500 hover:text-gray-700 py-2"
            >
              Cancel
            </a>
          </div>
        </Form>
      </div>
    );
  },
);
