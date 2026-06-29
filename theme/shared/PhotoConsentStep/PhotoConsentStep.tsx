import { $, component$, useSignal, useVisibleTask$, type QRL, type Signal } from "@qwik.dev/core";
import { Alert } from "~/components/ui/Alert";

export type PhotoConsentStepProps = {
  /** true/false if already answered, null if never asked. */
  initialValue: boolean | null;
  /** Pass the result of useSavePhotoConsent() (see ../../../src/components/setup/PhotoConsentStep/useSavePhotoConsent) called in the parent route. */
  updateAction: any;
  onComplete$?: QRL<() => void>;
  /** When provided: parent controls saving. When omitted: auto-saves on selection change. */
  saveTrigger?: Signal<number>;
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
        await props.onComplete$?.();
      }
    }
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
    <div class="space-y-4 p-6 border border-border rounded-lg bg-white">
      <div>
        <h2 class="text-xl font-semibold">Photo consent</h2>
        <p class="text-text-secondary mt-1">
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
              given.value === true ? "border-primary bg-info-bg" : "border-border hover:border-border-strong"
            }`}
          >
            <input
              type="radio"
              name="photo_consent"
              checked={given.value === true}
              onChange$={() => { given.value = true; if (!props.saveTrigger) void saveFn(); }}
              class="sr-only"
            />
            <span class="text-2xl">📷</span>
            <div>
              <p class="font-medium">Yes, I consent</p>
              <p class="text-sm text-text-muted">Photos may be taken of me</p>
            </div>
          </label>

          <label
            class={`flex-1 flex items-center gap-3 p-4 border-2 rounded-lg cursor-pointer transition-colors ${
              given.value === false ? "border-primary bg-info-bg" : "border-border hover:border-border-strong"
            }`}
          >
            <input
              type="radio"
              name="photo_consent"
              checked={given.value === false}
              onChange$={() => { given.value = false; if (!props.saveTrigger) void saveFn(); }}
              class="sr-only"
            />
            <span class="text-2xl">🚫</span>
            <div>
              <p class="font-medium">No, opt out</p>
              <p class="text-sm text-text-muted">Please don't photograph me</p>
            </div>
          </label>
        </div>
      )}
    </div>
  );
});
