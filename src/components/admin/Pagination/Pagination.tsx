import { component$ } from "@qwik.dev/core";
import { useLocation } from "@qwik.dev/router";

interface PaginationProps {
  page: number;
  totalPages: number;
  total: number;
  pageSize: number;
}

export const PAGE_SIZE = 25;

export const Pagination = component$<PaginationProps>(
  ({ page, totalPages, total, pageSize }) => {
    const loc = useLocation();

    const buildHref = (targetPage: number) => {
      const params = new URLSearchParams(loc.url.searchParams.toString());
      if (targetPage <= 1) params.delete("page");
      else params.set("page", String(targetPage));
      const qs = params.toString();
      return qs ? `?${qs}` : "?";
    };

    const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
    const to = Math.min(page * pageSize, total);

    const pageNumbers: (number | "...")[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pageNumbers.push(i);
    } else {
      const near = new Set<number>();
      near.add(1);
      near.add(totalPages);
      for (
        let i = Math.max(1, page - 2);
        i <= Math.min(totalPages, page + 2);
        i++
      ) {
        near.add(i);
      }
      let prev = 0;
      for (const p of [...near].sort((a, b) => a - b)) {
        if (p - prev > 1) pageNumbers.push("...");
        pageNumbers.push(p);
        prev = p;
      }
    }

    return (
      <div class="flex items-center justify-between px-6 py-3 border-t border-gray-200 bg-white text-sm select-none">
        <span class="text-gray-500">
          {total === 0
            ? "No results"
            : `Showing ${from}–${to} of ${total}`}
        </span>
        {totalPages > 1 && (
          <nav class="flex items-center gap-1">
            {page > 1 ? (
              <a
                href={buildHref(page - 1)}
                class="px-3 py-1 rounded border border-gray-300 text-gray-600 hover:bg-gray-50"
              >
                ←
              </a>
            ) : (
              <span class="px-3 py-1 rounded border border-gray-200 text-gray-300 cursor-not-allowed">
                ←
              </span>
            )}
            {pageNumbers.map((p, i) =>
              p === "..." ? (
                <span key={`e${i}`} class="px-2 py-1 text-gray-400">
                  …
                </span>
              ) : (
                <a
                  key={p}
                  href={buildHref(p as number)}
                  class={
                    p === page
                      ? "px-3 py-1 rounded border text-sm bg-blue-600 text-white border-blue-600"
                      : "px-3 py-1 rounded border text-sm border-gray-300 text-gray-600 hover:bg-gray-50"
                  }
                >
                  {p}
                </a>
              ),
            )}
            {page < totalPages ? (
              <a
                href={buildHref(page + 1)}
                class="px-3 py-1 rounded border border-gray-300 text-gray-600 hover:bg-gray-50"
              >
                →
              </a>
            ) : (
              <span class="px-3 py-1 rounded border border-gray-200 text-gray-300 cursor-not-allowed">
                →
              </span>
            )}
          </nav>
        )}
      </div>
    );
  },
);
