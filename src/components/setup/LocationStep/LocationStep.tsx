import { component$, type Signal, useSignal } from "@qwik.dev/core";
import { Form, routeAction$, z, zod$ } from "@qwik.dev/router";
import { Button } from "~/components/ui/Button";
import { AddressAutocomplete } from "~/components/ui/AddressAutocomplete";
import { Alert } from "~/components/ui/Alert";
import { requireAuth } from "~/utils/server-auth";
import { usersService } from "~/services/users.service";
import { markConsentStepComplete } from "~/utils/onboarding";

/**
 * Co-located server action — re-export this from any route that embeds LocationStep.
 * e.g. export { useMarkLocation } from "~/components/setup/LocationStep";
 */
export const useMarkLocation = routeAction$(
  async (data, event) => {
    const user = await requireAuth(event);
    await usersService.update(user.id, {
      city: data.city || null,
      country: data.country || null,
      latitude: data.latitude || null,
      longitude: data.longitude || null,
    });
    await markConsentStepComplete(user.id, "locationVerification");
    return { success: true };
  },
  zod$({
    city: z.string().optional(),
    country: z.string().optional(),
    latitude: z.string().optional(),
    longitude: z.string().optional(),
  }),
);

export type LocationStepProps = {
  isComplete?: boolean;
  /** Pass the result of useMarkLocation() called in the parent route. */
  updateAction: any;
  onComplete?: () => void;
  saveTrigger?: Signal<number>;
};

export const LocationStep = component$<LocationStepProps>((props) => {
  const latitude = useSignal("");
  const longitude = useSignal("");
  const city = useSignal("");
  const country = useSignal("");

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
