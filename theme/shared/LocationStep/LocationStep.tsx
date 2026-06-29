import { component$, type Signal, useSignal, useVisibleTask$ } from "@qwik.dev/core";
import { Form } from "@qwik.dev/router";
import { AddressAutocomplete } from "~/components/ui/AddressAutocomplete";
import { Alert } from "~/components/ui/Alert";

export type LocationStepProps = {
  isComplete?: boolean;
  /** Pass the result of useMarkLocation() (see ../../../src/components/setup/LocationStep/useMarkLocation) called in the parent route. */
  updateAction: any;
  onComplete?: () => void;
  saveTrigger?: Signal<number>;
};

export const LocationStep = component$<LocationStepProps>((props) => {
  const latitude = useSignal("");
  const longitude = useSignal("");
  const city = useSignal("");
  const country = useSignal("");

  useVisibleTask$(({ track }) => {
    const trigger = track(() => props.saveTrigger?.value);
    if (trigger && trigger > 0) {
      document.getElementById("location-form-save")?.click();
    }
  });

  return (
    <Form action={props.updateAction} id="location-step-form">
      <div class="space-y-4 p-6 border border-gray-200 rounded-lg bg-white">
        <div>
          <h2 class="text-xl font-semibold">Location verification</h2>
          <p class="text-gray-600 mt-1">
            Confirm your location so we can keep your profile up to date.
          </p>
        </div>

        <input type="hidden" name="city" value={city.value} />
        <input type="hidden" name="country" value={country.value} />
        <input type="hidden" name="latitude" value={latitude.value} />
        <input type="hidden" name="longitude" value={longitude.value} />

        {props.isComplete ? (
          <Alert variant="success">Verified — thank you!</Alert>
        ) : (
          <div class="space-y-3">
            <AddressAutocomplete
              name="onboarding_location"
              label="Address"
              placeholder="Start typing your city or address..."
              latitudeSignal={latitude}
              longitudeSignal={longitude}
              citySignal={city}
              countrySignal={country}
            />
          </div>
        )}

        <button type="submit" id="location-form-save" class="hidden" />
      </div>
    </Form>
  );
});
