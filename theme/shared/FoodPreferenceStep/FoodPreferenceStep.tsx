import { $, component$, useSignal, useVisibleTask$, type QRL, type Signal } from "@qwik.dev/core";
import { Alert } from "~/components/ui/Alert";

export type FoodPreferenceStepProps = {
  initialPreference?: string | null;
  isComplete?: boolean;
  /** Pass the result of useSaveFoodPreference() (see ../../../src/components/setup/FoodPreferenceStep/useSaveFoodPreference) called in the parent route. */
  updateAction: any;
  onComplete$?: QRL<() => void>;
  /** When provided: parent controls saving; no save button rendered. When omitted: auto-saves on selection change. */
  saveTrigger?: Signal<number>;
};

export const FoodPreferenceStep = component$<FoodPreferenceStepProps>((props) => {
  const preference = useSignal(props.initialPreference || "");
  const completed = useSignal(props.isComplete ?? false);

  const saveFn = $(async () => {
    if (props.updateAction && typeof props.updateAction.submit === "function") {
      const formData = new FormData();
      formData.set("preference", preference.value);
      await props.updateAction.submit(formData);
      if (props.updateAction.value?.success) {
        completed.value = true;
        await props.onComplete$?.();
      }
      return props.updateAction.value;
    }

    return { error: "No server action provided" };
  });

  const lastSaved = useSignal(props.saveTrigger?.value ?? 0);
  useVisibleTask$(({ track }) => {
    if (!props.saveTrigger) return;
    track(() => props.saveTrigger!.value);
    if (props.saveTrigger.value !== lastSaved.value) {
      lastSaved.value = props.saveTrigger.value;
      void saveFn();
    }
  });

  return (
    <div class="space-y-4 p-6 border border-gray-200 rounded-lg bg-white">
      <div>
        <h2 class="text-xl font-semibold">Food preferences</h2>
        <p class="text-gray-600 mt-1">
          Let us know your dietary preferences so we can plan accordingly.
        </p>
      </div>

      {completed.value ? (
        <Alert variant="success">Food preference saved.</Alert>
      ) : (
        <div class="space-y-3">
          <label class="block text-sm font-medium text-gray-700">Dietary preference</label>
          <select
            class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-hidden focus:ring-2 focus:ring-blue-500"
            value={preference.value}
            onChange$={(event) => {
              preference.value = (event.target as HTMLSelectElement).value;
              if (!props.saveTrigger) void saveFn();
            }}
          >
            <option value="">No preference</option>
            <option value="vegetarian">Vegetarian</option>
            <option value="vegan">Vegan</option>
            <option value="gluten_free">Gluten-free</option>
            <option value="halal">Halal</option>
            <option value="kosher">Kosher</option>
          </select>
        </div>
      )}
    </div>
  );
});
