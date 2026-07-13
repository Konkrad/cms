import { component$, useSignal, useTask$ } from "@qwik.dev/core";
import { Form } from "@qwik.dev/router";
import { Button } from "~/components/ui/Button";
import { AddressAutocomplete } from "~/components/ui/AddressAutocomplete";
import type { UpdateLocationAction } from "~/contracts/profile";

export interface ProfileLocationEditProps {
  city?: string | null;
  country?: string | null;
  updateAction: UpdateLocationAction;
}

/** In-place location editor: click the city/country text to edit it inline. */
export const ProfileLocationEdit = component$<ProfileLocationEditProps>((props) => {
  const { updateAction } = props;
  const isEditing = useSignal(false);
  const city = useSignal(props.city || "");
  const country = useSignal(props.country || "");
  const latitude = useSignal("");
  const longitude = useSignal("");

  useTask$(({ track }) => {
    const result = track(() => updateAction.value);
    if (result?.success) isEditing.value = false;
  });

  const currentLocation = [props.city, props.country].filter(Boolean).join(", ");

  if (!isEditing.value) {
    return (
      <div class="flex items-center gap-2 group">
        {currentLocation && (
          <p class="text-text-muted text-sm">{currentLocation}</p>
        )}
        <button
          type="button"
          aria-label="Edit location"
          onClick$={() => { isEditing.value = true; }}
          class="text-text-muted hover:text-primary opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M16.862 4.487a2.1 2.1 0 1 1 2.97 2.97L7.5 19.79l-4 1 1-4L16.862 4.487Z"
            />
          </svg>
        </button>
      </div>
    );
  }

  return (
    <Form action={updateAction} class="space-y-2 max-w-xs">
      {(updateAction.value as any)?.error && (
        <p class="text-xs text-error">{(updateAction.value as any).error}</p>
      )}
      <input type="hidden" name="city" value={city.value} />
      <input type="hidden" name="country" value={country.value} />
      <input type="hidden" name="latitude" value={latitude.value} />
      <input type="hidden" name="longitude" value={longitude.value} />
      <AddressAutocomplete
        name="location_search"
        label="Location"
        placeholder="Start typing your city..."
        value={currentLocation}
        latitudeSignal={latitude}
        longitudeSignal={longitude}
        citySignal={city}
        countrySignal={country}
      />
      <div class="flex gap-2">
        <Button type="submit" size="sm">Save</Button>
        <Button type="button" variant="secondary" size="sm" onClick$={() => { isEditing.value = false; }}>
          Cancel
        </Button>
      </div>
    </Form>
  );
});
