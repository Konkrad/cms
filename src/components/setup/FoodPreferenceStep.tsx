import { component$, useSignal, useVisibleTask$, type Signal } from "@builder.io/qwik";
import { routeAction$, z, zod$ } from "@builder.io/qwik-city";
import { Button } from "~/components/ui/Button";
import { requireAuth } from "~/utils/server-auth";
import { usersService } from "~/services/users.service";
import { markConsentStepComplete } from "~/utils/onboarding";

/**
 * Co-located server action — re-export this from any route that embeds FoodPreferenceStep.
 * e.g. export { useSaveFoodPreference } from "~/components/setup/FoodPreferenceStep";
 */
export const useSaveFoodPreference = routeAction$(
  async (data, event) => {
    const user = await requireAuth(event);
    await usersService.update(user.id, { foodPreference: data.preference || null });
    await markConsentStepComplete(user.id, "foodPreference");
    return { success: true };
  },
  zod$({
    preference: z.string().optional(),
  }),
);

export type FoodPreferenceStepProps = {
  initialPreference?: string | null;
  isComplete?: boolean;
  /** Pass the result of useSaveFoodPreference() called in the parent route. */
  updateAction: any;
  onComplete?: () => void;
  saveTrigger: Signal<number>;
};

export const FoodPreferenceStep = component$<FoodPreferenceStepProps>((props) => {
  const preference = useSignal(props.initialPreference || "");
  const completed = useSignal(props.isComplete ?? false);

  const saveFn = async () => {
    if (props.updateAction && typeof props.updateAction.submit === "function") {
      const formData = new FormData();
      formData.set("preference", preference.value);
      await props.updateAction.submit(formData);
      if (props.updateAction.value?.success) {
        completed.value = true;
        props.onComplete?.();
      }
      return props.updateAction.value;
    }

    return { error: "No server action provided" };
  };

  const lastSaved = useSignal(props.saveTrigger?.value ?? 0);
  useVisibleTask$(({ track }) => {
    track(() => props.saveTrigger.value);
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
        </div>
      )}
    </div>
  );
});
