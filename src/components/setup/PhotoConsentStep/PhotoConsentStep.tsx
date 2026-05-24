import { $, component$, useSignal, useVisibleTask$, type Signal } from "@qwik.dev/core";
import { routeAction$, z, zod$ } from "@qwik.dev/router";
import { Alert } from "~/components/ui/Alert";
import { requireAuth } from "~/utils/server-auth";
import { usersService } from "~/services/users.service";
import { markConsentStepComplete } from "~/utils/onboarding";

/**
 * Co-located server action — re-export this from any route that embeds PhotoConsentStep.
 * e.g. export { useSavePhotoConsent } from "~/components/setup/PhotoConsentStep";
 */
export const useSavePhotoConsent = routeAction$(
  async (data, event) => {
    const user = await requireAuth(event);
    await usersService.update(user.id, { photoConsentGiven: data.given } as any);
    await markConsentStepComplete(user.id, "photoConsent");
    return { success: true };
  },
  zod$({ given: z.boolean() }),
);

export type PhotoConsentStepProps = {
  /** true/false if already answered, null if never asked. */
  initialValue: boolean | null;
  /** Pass the result of useSavePhotoConsent() called in the parent route. */
  updateAction: any;
  onComplete?: () => void;
  saveTrigger: Signal<number>;
};

export const PhotoConsentStep = component$<PhotoConsentStepProps>((props) => {
  const given = useSignal<boolean | null>(props.initialValue);
  const completed = useSignal(props.initialValue !== null);

  const saveFn = $(async () => {
    if (given.value === null) return;
    if (props.updateAction && typeof props.updateAction.submit === "function") {
      const formData = new FormData();
      formData.set("given", given.value ? "true" : "false");
      await props.updateAction.submit(formData);
      if (props.updateAction.value?.success) {
        completed.value = true;
        props.onComplete?.();
      }
    }
  });

  const lastSaved = useSignal(props.saveTrigger.value);
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
        <h2 class="text-xl font-semibold">Photo consent</h2>
        <p class="text-gray-600 mt-1">
          Photos and videos may be taken during this event for documentation and
          promotion. Do you consent to being photographed?
        </p>
      </div>

      {completed.value ? (
        <Alert variant="success">
          {given.value ? "You have consented to being photographed." : "You have opted out of being photographed."}
        </Alert>
      ) : (
        <div class="flex gap-4">
          <label
            class={`flex-1 flex items-center gap-3 p-4 border-2 rounded-lg cursor-pointer transition-colors ${
              given.value === true ? "border-blue-500 bg-blue-50" : "border-gray-200 hover:border-gray-300"
            }`}
          >
            <input
              type="radio"
              name="photo_consent"
              checked={given.value === true}
              onChange$={() => { given.value = true; }}
              class="sr-only"
            />
            <span class="text-2xl">📷</span>
            <div>
              <p class="font-medium">Yes, I consent</p>
              <p class="text-sm text-gray-500">Photos may be taken of me</p>
            </div>
          </label>

          <label
            class={`flex-1 flex items-center gap-3 p-4 border-2 rounded-lg cursor-pointer transition-colors ${
              given.value === false ? "border-blue-500 bg-blue-50" : "border-gray-200 hover:border-gray-300"
            }`}
          >
            <input
              type="radio"
              name="photo_consent"
              checked={given.value === false}
              onChange$={() => { given.value = false; }}
              class="sr-only"
            />
            <span class="text-2xl">🚫</span>
            <div>
              <p class="font-medium">No, opt out</p>
              <p class="text-sm text-gray-500">Please don't photograph me</p>
            </div>
          </label>
        </div>
      )}
    </div>
  );
});
