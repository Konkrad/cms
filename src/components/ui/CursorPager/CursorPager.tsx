import { component$, type QRL } from "@qwik.dev/core";

interface CursorPagerProps {
  currentPage: number;
  totalKnownPages: number;
  isLoading?: boolean;
  onPageChange$: QRL<(page: number) => void>;
}

export const CursorPager = component$<CursorPagerProps>(
  ({ currentPage, totalKnownPages, isLoading, onPageChange$ }) => {
    if (totalKnownPages <= 1) return null;

    return (
      <div class="flex items-center justify-center gap-2 pt-8">
        {Array.from({ length: totalKnownPages }, (_, i) => i + 1).map((page) => (
          <button
            key={page}
            class={[
              "w-9 h-9 rounded-lg text-sm font-medium transition-colors",
              page === currentPage
                ? "bg-primary text-white cursor-default"
                : "border border-gray-300 text-gray-700 bg-white hover:bg-gray-50",
              isLoading && page !== currentPage ? "opacity-50 cursor-not-allowed" : "",
            ].join(" ")}
            disabled={isLoading || page === currentPage}
            onClick$={() => onPageChange$(page)}
          >
            {page}
          </button>
        ))}
      </div>
    );
  },
);
