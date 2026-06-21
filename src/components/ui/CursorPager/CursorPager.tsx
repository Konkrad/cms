import { component$, type QRL } from "@qwik.dev/core";

interface PageButtonProps {
  page: number;
  isActive: boolean;
  isLoading?: boolean;
  onPageChange$: QRL<(page: number) => void>;
}

// Separate component so `page` and `onPageChange$` are serialized as props,
// not captured as loop variables inside a $() closure (which Qwik can't serialize).
const PageButton = component$<PageButtonProps>(
  ({ page, isActive, isLoading, onPageChange$ }) => (
    <button
      class={[
        "w-9 h-9 rounded-lg text-sm font-medium transition-colors",
        isActive
          ? "bg-primary text-white cursor-default"
          : "border border-gray-300 text-gray-700 bg-white hover:bg-gray-50",
        isLoading && !isActive ? "opacity-50 cursor-not-allowed" : "",
      ].join(" ")}
      disabled={isLoading || isActive}
      onClick$={() => onPageChange$(page)}
    >
      {page}
    </button>
  ),
);

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
          <PageButton
            key={page}
            page={page}
            isActive={page === currentPage}
            isLoading={isLoading}
            onPageChange$={onPageChange$}
          />
        ))}
      </div>
    );
  },
);
