import {
  component$,
  useSignal,
  useVisibleTask$,
  $,
  type Signal,
} from "@builder.io/qwik";
import {
  geocodingService,
  type GeocodingResult,
} from "~/services/geocoding.service";

interface AddressAutocompleteProps {
  name: string;
  label: string;
  placeholder?: string;
  required?: boolean;
  value?: string;
  latitudeSignal: Signal<string>;
  longitudeSignal: Signal<string>;
  citySignal: Signal<string>;
  countrySignal: Signal<string>;
}

export const AddressAutocomplete = component$<AddressAutocompleteProps>(
  ({
    name,
    label,
    placeholder = "Start typing an address...",
    required = false,
    value = "",
    latitudeSignal,
    longitudeSignal,
    citySignal,
    countrySignal,
  }) => {
    const inputValue = useSignal(value);
    const suggestions = useSignal<GeocodingResult[]>([]);
    const showSuggestions = useSignal(false);
    const isLoading = useSignal(false);
    const debounceTimer = useSignal<number | undefined>(undefined);

    const handleInput$ = $(async (query: string) => {
      inputValue.value = query;

      if (debounceTimer.value) {
        clearTimeout(debounceTimer.value);
      }

      if (query.length < 3) {
        suggestions.value = [];
        showSuggestions.value = false;
        return;
      }

      isLoading.value = true;

      debounceTimer.value = setTimeout(async () => {
        try {
          const results = await geocodingService.forward(query);
          suggestions.value = results;
          showSuggestions.value = true;
        } catch (error) {
          console.error("Geocoding error:", error);
          suggestions.value = [];
        } finally {
          isLoading.value = false;
        }
      }, 300) as any;
    });

    const selectSuggestion$ = $((result: GeocodingResult) => {
      inputValue.value = result.fullAddress;
      latitudeSignal.value = result.latitude.toString();
      longitudeSignal.value = result.longitude.toString();
      citySignal.value = result.city || "";
      countrySignal.value = result.country || "";
      showSuggestions.value = false;
      suggestions.value = [];
    });

    const handleBlur$ = $(() => {
      // Delay hiding suggestions to allow click event to fire
      setTimeout(() => {
        showSuggestions.value = false;
      }, 200);
    });

    useVisibleTask$(({ track }) => {
      track(() => value);
      if (value !== inputValue.value) {
        inputValue.value = value;
      }
    });

    return (
      <div class="relative">
        <label class="block text-sm font-medium text-gray-700 mb-1">
          {label}
          {required && <span class="text-red-500 ml-1">*</span>}
        </label>
        <div class="relative">
          <input
            type="text"
            name={name}
            value={inputValue.value}
            placeholder={placeholder}
            required={required}
            class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            onInput$={(e) => handleInput$((e.target as HTMLInputElement).value)}
            onFocus$={() => {
              if (suggestions.value.length > 0) {
                showSuggestions.value = true;
              }
            }}
            onBlur$={handleBlur$}
            autoComplete="off"
          />
          {isLoading.value && (
            <div class="absolute right-3 top-2.5">
              <div class="animate-spin h-5 w-5 border-2 border-gray-300 border-t-blue-500 rounded-full"></div>
            </div>
          )}
        </div>

        {showSuggestions.value && suggestions.value.length > 0 && (
          <div class="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
            {suggestions.value.map((result, index) => (
              <div
                key={index}
                class="px-4 py-2 hover:bg-blue-50 cursor-pointer border-b border-gray-100 last:border-b-0"
                onClick$={() => selectSuggestion$(result)}
              >
                <div class="text-sm font-medium text-gray-900">
                  {result.displayName}
                </div>
                {(result.city || result.country) && (
                  <div class="text-xs text-gray-500 mt-1">
                    {[result.city, result.country].filter(Boolean).join(", ")}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Hidden fields for latitude, longitude, city, and country */}
        <input type="hidden" name="latitude" value={latitudeSignal.value} />
        <input type="hidden" name="longitude" value={longitudeSignal.value} />
        <input type="hidden" name="city" value={citySignal.value} />
        <input type="hidden" name="country" value={countrySignal.value} />
      </div>
    );
  },
);
