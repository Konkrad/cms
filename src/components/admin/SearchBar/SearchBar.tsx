import { component$ } from "@qwik.dev/core";
import { useLocation } from "@qwik.dev/router";

interface SearchBarProps {
  value: string;
  placeholder?: string;
}

export const SearchBar = component$<SearchBarProps>(
  ({ value, placeholder = "Search…" }) => {
    const loc = useLocation();
    const action = loc.url.pathname;

    return (
      <form method="get" action={action} class="flex gap-2 mb-4">
        <input
          type="text"
          name="search"
          value={value}
          placeholder={placeholder}
          class="border border-gray-300 rounded-lg px-3 py-2 text-sm w-72 focus:outline-none focus:ring-2 focus:ring-blue-400"
        />
        <button
          type="submit"
          class="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700"
        >
          Search
        </button>
        {value && (
          <a
            href={action}
            class="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 border border-gray-300 rounded-lg"
          >
            Clear
          </a>
        )}
      </form>
    );
  },
);
