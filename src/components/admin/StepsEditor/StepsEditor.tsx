import { component$, useSignal, $, type QRL } from "@qwik.dev/core";
import type { DealStep } from "~/db/schemas/deals";
import { Button } from "~/components/ui/Button";
import { Input } from "~/components/ui/Input";
import { Select } from "~/components/ui/Select";
import { TextArea } from "~/components/ui/TextArea";

interface StepsEditorProps {
  initialSteps?: DealStep[];
  name?: string;
}

const emptyStep = (): DealStep => ({
  type: "text",
  title: "",
  text: "",
  requiresLogin: false,
});

export const StepsEditor = component$<StepsEditorProps>(
  ({ initialSteps = [], name = "steps" }) => {
    const steps = useSignal<DealStep[]>(
      initialSteps.length > 0 ? initialSteps : [],
    );

    const addStep$ = $(() => {
      steps.value = [...steps.value, emptyStep()];
    });

    const removeStep$: QRL<(index: number) => void> = $((index: number) => {
      steps.value = steps.value.filter((_, i) => i !== index);
    });

    const updateStep$: QRL<
      (index: number, patch: Partial<DealStep>) => void
    > = $((index: number, patch: Partial<DealStep>) => {
      const next = steps.value.map((s, i) =>
        i === index ? { ...s, ...patch } : s,
      );
      steps.value = next;
    });

    return (
      <div class="flex flex-col gap-4">
        <input type="hidden" name={name} value={JSON.stringify(steps.value)} />

        {steps.value.length === 0 && (
          <p class="text-sm text-gray-500">
            No steps yet. Add a step below.
          </p>
        )}

        {steps.value.map((step, index) => (
          <div
            key={index}
            class="border border-border-strong rounded-lg p-4 flex flex-col gap-3 bg-gray-50"
          >
            <div class="flex items-center justify-between">
              <span class="text-sm font-semibold text-gray-700">
                Step {index + 1}
              </span>
              <button
                type="button"
                onClick$={() => removeStep$(index)}
                class="text-sm text-red-500 hover:text-red-700"
              >
                Remove
              </button>
            </div>

            <div class="grid grid-cols-2 gap-3">
              <Select
                label="Type"
                value={step.type}
                onChange$={(e) =>
                  updateStep$(index, {
                    type: (e.target as HTMLSelectElement).value as DealStep["type"],
                  })
                }
              >
                <option value="text">Text</option>
                <option value="link">Link</option>
                <option value="promo">Promo Code</option>
              </Select>

              <div class="flex items-end pb-1">
                <label class="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={step.requiresLogin ?? false}
                    onChange$={(e) =>
                      updateStep$(index, {
                        requiresLogin: (e.target as HTMLInputElement).checked,
                      })
                    }
                    class="rounded"
                  />
                  <span class="text-sm font-medium text-text">
                    Requires login
                  </span>
                </label>
              </div>
            </div>

            <Input
              label="Title"
              value={step.title}
              onInput$={(e) =>
                updateStep$(index, {
                  title: (e.target as HTMLInputElement).value,
                })
              }
              required
            />

            <TextArea
              label="Text"
              value={step.text}
              rows={2}
              onInput$={(e) =>
                updateStep$(index, {
                  text: (e.target as HTMLTextAreaElement).value,
                })
              }
            />

            {step.type === "link" && (
              <>
                <Input
                  label="URL"
                  type="url"
                  value={step.link ?? ""}
                  onInput$={(e) =>
                    updateStep$(index, {
                      link: (e.target as HTMLInputElement).value,
                    })
                  }
                  placeholder="https://example.com"
                />
                <Input
                  label="Link Text"
                  value={step.linkText ?? ""}
                  onInput$={(e) =>
                    updateStep$(index, {
                      linkText: (e.target as HTMLInputElement).value,
                    })
                  }
                  placeholder="Go to the Website"
                />
              </>
            )}

            {step.type === "promo" && (
              <Input
                label="Promo Code"
                value={step.promoCode ?? ""}
                onInput$={(e) =>
                  updateStep$(index, {
                    promoCode: (e.target as HTMLInputElement).value,
                  })
                }
                placeholder="DISCOUNT2026"
              />
            )}
          </div>
        ))}

        <div>
          <Button type="button" variant="secondary" size="sm" onClick$={addStep$}>
            + Add Step
          </Button>
        </div>
      </div>
    );
  },
);
