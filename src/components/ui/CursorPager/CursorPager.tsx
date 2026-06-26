import { component$, type QRL } from "@qwik.dev/core";

interface CursorPagerProps {
  hasPrevious: boolean;
  hasNext: boolean;
  isLoading?: boolean;
  onPrevious$: QRL<() => void>;
  onNext$: QRL<() => void>;
}

// Cursors encode absolute DB sort-key coordinates, so both neighbors of the
// current page are known directly from the service response — no chain of
// visited pages to walk, so there's no notion of an arbitrary page number.
export const CursorPager = component$<CursorPagerProps>(
  ({ hasPrevious, hasNext, isLoading, onPrevious$, onNext$ }) => {
    if (!hasPrevious && !hasNext) return null;

    return (
      <div class="flex items-center justify-center gap-3 pt-8">
        <button
          class={[
            "px-4 py-2 rounded-lg text-sm font-medium border transition-colors",
            hasPrevious && !isLoading
              ? "border-gray-300 text-gray-700 bg-white hover:bg-gray-50"
              : "border-gray-200 text-gray-300 cursor-not-allowed",
          ].join(" ")}
          disabled={!hasPrevious || isLoading}
          onClick$={onPrevious$}
        >
          ← Previous
        </button>
        <button
          class={[
            "px-4 py-2 rounded-lg text-sm font-medium border transition-colors",
            hasNext && !isLoading
              ? "border-gray-300 text-gray-700 bg-white hover:bg-gray-50"
              : "border-gray-200 text-gray-300 cursor-not-allowed",
          ].join(" ")}
          disabled={!hasNext || isLoading}
          onClick$={onNext$}
        >
          Next →
        </button>
      </div>
    );
  },
);
