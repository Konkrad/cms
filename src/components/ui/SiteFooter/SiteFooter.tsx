import { component$ } from "@qwik.dev/core";
import { useFooterMenuItems } from "~/routes/layout";

export const SiteFooter = component$(() => {
  const footerItems = useFooterMenuItems();

  if (!Array.isArray(footerItems.value) || footerItems.value.length === 0) {
    return null;
  }

  const sortedItems = [...footerItems.value].sort((a, b) => a.position - b.position);

  return (
    <footer class="border-t border-gray-200 bg-white">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5">
        <div class="flex flex-wrap items-center gap-x-6 gap-y-3 text-sm text-gray-600">
          {sortedItems.map((item) => (
            <a
              key={item.id}
              href={item.url}
              target={item.target}
              rel={item.target === "_blank" ? "noopener noreferrer" : undefined}
              class="inline-flex items-center gap-2 hover:text-blue-600"
            >
              {item.icon && item.icon.trim().startsWith("<svg") ? (
                <span
                  class="inline-flex items-center justify-center w-5 h-5"
                  dangerouslySetInnerHTML={item.icon}
                />
              ) : item.icon ? (
                <span class="inline-flex items-center justify-center w-5 h-5 rounded-full bg-gray-100 text-[10px] font-semibold text-gray-700">
                  {item.icon}
                </span>
              ) : null}
              <span>{item.label}</span>
            </a>
          ))}
        </div>
      </div>
    </footer>
  );
});
