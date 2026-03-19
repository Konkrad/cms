import { $, component$ } from "@builder.io/qwik";
import { Button } from "~/components/ui/Button";
import { markConsentStepComplete } from "~/utils/onboarding";

export type LocationStepProps = {
  userId: string;
  isComplete?: boolean;
  onComplete?: () => void;
};

export const LocationStep = component$<LocationStepProps>((props) => {
  const handleComplete = $(async () => {
    await markConsentStepComplete(props.userId, "locationVerification");
    props.onComplete?.();
  });

  return (
    <div class="space-y-4 p-6 border border-gray-200 rounded-lg bg-white">
      <div>
        <h2 class="text-xl font-semibold">Location verification</h2>
        <p class="text-gray-600 mt-1">
          Confirm your location so we can keep your profile up to date.
        </p>
      </div>

      {props.isComplete ? (
        <div class="p-4 rounded-lg bg-green-50 border border-green-200 text-green-800">
          Verified — thank you!
        </div>
      ) : (
        <Button variant="primary" onClick$={handleComplete}>
          Mark as verified
        </Button>
      )}
    </div>
  );
});
