import { $, component$, useVisibleTask$, type Signal, useSignal } from "@builder.io/qwik";
import { routeAction$, z, zod$ } from "@builder.io/qwik-city";
import { Button } from "~/components/ui/Button";
import { AddressAutocomplete } from "~/components/ui/AddressAutocomplete";
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
  saveTrigger: Signal<number>;
};

export const LocationStep = component$<LocationStepProps>((props) => {
  const latitude = useSignal("");
  const longitude = useSignal("");
  const city = useSignal("");
  const country = useSignal("");

  const handleComplete = $(async () => {
    if (props.updateAction && typeof props.updateAction.submit === "function") {
      const formData = new FormData();
      if (city.value) formData.set("city", city.value);
      if (country.value) formData.set("country", country.value);
      if (latitude.value) formData.set("latitude", latitude.value);
      if (longitude.value) formData.set("longitude", longitude.value);

      await props.updateAction.submit(formData);
      if (props.updateAction.value?.success) {
        props.onComplete?.();
      }
      return props.updateAction.value;
    }

    return { error: "No server action provided" };
  });

  const lastSaved = useSignal(props.saveTrigger?.value ?? 0);
  useVisibleTask$(({ track }) => {
    track(() => props.saveTrigger.value);
    if (props.saveTrigger.value !== lastSaved.value) {
      lastSaved.value = props.saveTrigger.value;
      void handleComplete();
    }
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
    </div>
  );
});
