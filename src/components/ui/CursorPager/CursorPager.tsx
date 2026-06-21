import { component$, type QRL } from "@qwik.dev/core";

interface CursorPagerProps {
  currentPage: number;
  totalKnownPages: number;
  isLoading?: boolean;
  onPageChange$: QRL<(page: number) => void>;
}

// Cursor pagination can only move one page at a time — there's no way to jump
// directly to an arbitrary page without walking the cursor chain — so the UI
// only offers Previous/Next rather than numbered page buttons.
export const CursorPager = component$<CursorPagerProps>(
  ({ currentPage, totalKnownPages, isLoading, onPageChange$ }) => {
    if (totalKnownPages <= 1) return null;

    const hasPrevious = currentPage > 1;
    const hasNext = currentPage < totalKnownPages;

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
          onClick$={() => onPageChange$(currentPage - 1)}
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
          onClick$={() => onPageChange$(currentPage + 1)}
        >
          Next →
        </button>
      </div>
    );
  },
);
