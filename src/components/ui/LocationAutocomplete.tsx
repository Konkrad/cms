import { component$, useSignal, type Signal, $ } from '@builder.io/qwik';
import { geocodingService, type GeocodingResult } from '~/services/geocoding.service';

interface LocationAutocompleteProps {
  name: string;
  label: string;
  required?: boolean;
  error?: string;
  searchType: 'city' | 'address';
  initialValue?: string;
  selectedLocation: Signal<GeocodingResult | null>;
}

export const LocationAutocomplete = component$<LocationAutocompleteProps>((props) => {
  const searchQuery = useSignal(props.initialValue || '');
  const suggestions = useSignal<GeocodingResult[]>([]);
  const isLoading = useSignal(false);
  const showDropdown = useSignal(false);
  const selectedLocation = useSignal<GeocodingResult | null>(null);
  const debounceTimer = useSignal<number | null>(null);

  const searchLocations = $(async (query: string) => {
    if (query.trim().length < 2) {
      suggestions.value = [];
      showDropdown.value = false;
      return;
    }

    isLoading.value = true;
    try {
      const results = await geocodingService.forward(query);
      suggestions.value = results;
      showDropdown.value = results.length > 0;
    } catch (error) {
      console.error('Geocoding search failed:', error);
      suggestions.value = [];
      showDropdown.value = false;
    } finally {
      isLoading.value = false;
    }
  });

  const handleInput = $((event: Event) => {
    const input = event.target as HTMLInputElement;
    searchQuery.value = input.value;
    selectedLocation.value = null;
    props.selectedLocation.value = null;

    if (debounceTimer.value) {
      clearTimeout(debounceTimer.value);
    }

    debounceTimer.value = window.setTimeout(() => {
      searchLocations(input.value);
    }, 400);
  });

  const handleSelectLocation = $((location: GeocodingResult) => {
    selectedLocation.value = location;
    searchQuery.value = props.searchType === 'city'
      ? `${location.city || ''}, ${location.country || ''}`.trim().replace(/^,\s*|,\s*$/g, '')
      : location.fullAddress;
    props.selectedLocation.value = location;
    showDropdown.value = false;
  });

  const handleBlur = $(() => {
    setTimeout(() => {
      showDropdown.value = false;
    }, 200);
  });

  return (
    <div class="relative">
      <label class="block text-sm font-medium text-gray-700 mb-1">
        {props.label}
        {props.required && <span class="text-red-500 ml-1">*</span>}
      </label>

      <div class="relative">
        <input
          type="text"
          value={searchQuery.value}
          onInput$={handleInput}
          onBlur$={handleBlur}
          onFocus$={() => {
            if (suggestions.value.length > 0) {
              showDropdown.value = true;
            }
          }}
          placeholder={props.searchType === 'city' ? 'Search for a city...' : 'Search for an address...'}
          class={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all ${
            props.error ? 'border-red-500' : 'border-gray-300'
          }`}
        />

        {isLoading.value && (
          <div class="absolute right-3 top-1/2 transform -translate-y-1/2">
            <div class="animate-spin h-5 w-5 border-2 border-blue-500 border-t-transparent rounded-full"></div>
          </div>
        )}
      </div>

      {showDropdown.value && suggestions.value.length > 0 && (
        <div class="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
          {suggestions.value.map((location, index) => (
            <button
              key={index}
              type="button"
              onClick$={() => handleSelectLocation(location)}
              class="w-full text-left px-4 py-3 hover:bg-blue-50 transition-colors border-b border-gray-100 last:border-b-0"
            >
              <div class="text-sm text-gray-900">{location.displayName}</div>
              {(location.city || location.country) && (
                <div class="text-xs text-gray-500 mt-1">
                  {location.city && location.country
                    ? `${location.city}, ${location.country}`
                    : location.city || location.country}
                </div>
              )}
            </button>
          ))}
        </div>
      )}

      {selectedLocation.value && (
        <div class="mt-2 text-sm text-green-600 flex items-center gap-2">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
          </svg>
          <span>Location selected</span>
        </div>
      )}

      {props.error && (
        <p class="mt-1 text-sm text-red-500">{props.error}</p>
      )}
    </div>
  );
});
