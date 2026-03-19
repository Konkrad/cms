import { component$, useSignal } from "@builder.io/qwik";
import { Button } from "~/components/ui/Button";
import { markConsentStepComplete } from "~/utils/onboarding";

export type FoodPreferenceStepProps = {
  userId: string;
  initialPreference?: string;
  onComplete?: () => void;
};

export const FoodPreferenceStep = component$<FoodPreferenceStepProps>((props) => {
  const preference = useSignal(props.initialPreference || "");
  const completed = useSignal(false);

  const handleSave = async () => {
    // In a full implementation this would persist the preference somewhere.
    // Here we just mark the step as complete.
    await markConsentStepComplete(props.userId, "foodPreference");
    completed.value = true;
    props.onComplete?.();
  };

  return (
    <div class="space-y-4 p-6 border border-gray-200 rounded-lg bg-white">
      <div>
        <h2 class="text-xl font-semibold">Food preferences</h2>
        <p class="text-gray-600 mt-1">
          Let us know your dietary preferences so we can plan accordingly.
        </p>
      </div>

      {completed.value ? (
        <div class="p-4 rounded-lg bg-green-50 border border-green-200 text-green-800">
          Food preference saved.
        </div>
      ) : (
        <div class="space-y-3">
          <label class="block text-sm font-medium text-gray-700">Dietary preference</label>
          <select
            class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={preference.value}
            onChange$={(event) => {
              preference.value = (event.target as HTMLSelectElement).value;
            }}
          >
            <option value="">No preference</option>
            <option value="vegetarian">Vegetarian</option>
            <option value="vegan">Vegan</option>
            <option value="gluten_free">Gluten-free</option>
            <option value="halal">Halal</option>
            <option value="kosher">Kosher</option>
          </select>

          <Button variant="primary" onClick$={handleSave} disabled={!preference.value}>
            Save preference
          </Button>
        </div>
      )}
    </div>
  );
});
