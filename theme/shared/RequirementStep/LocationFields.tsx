import { component$, useSignal } from "@qwik.dev/core";
import { AddressAutocomplete } from "~/components/ui/AddressAutocomplete";

export type LocationFieldsProps = {
	/** The viewer's own city/country (prefill). */
	values: Record<string, unknown>;
};

const text = (v: unknown) => (v == null ? "" : String(v));

/** Fields of the `core.location` requirement step (inside `RequirementStep`'s form). */
export const LocationFields = component$<LocationFieldsProps>(({ values }) => {
	const latitude = useSignal("");
	const longitude = useSignal("");
	const city = useSignal(text(values.city));
	const country = useSignal(text(values.country));

	return (
		<div class="space-y-3">
			<input type="hidden" name="city" value={city.value} />
			<input type="hidden" name="country" value={country.value} />
			<input type="hidden" name="latitude" value={latitude.value} />
			<input type="hidden" name="longitude" value={longitude.value} />
			{(city.value || country.value) && (
				<p class="text-sm text-text-secondary" data-testid="location-current">
					{[city.value, country.value].filter(Boolean).join(", ")}
				</p>
			)}
			<AddressAutocomplete
				name="addressSearch"
				label="Address"
				placeholder="Start typing your city or address..."
				latitudeSignal={latitude}
				longitudeSignal={longitude}
				citySignal={city}
				countrySignal={country}
			/>
		</div>
	);
});
