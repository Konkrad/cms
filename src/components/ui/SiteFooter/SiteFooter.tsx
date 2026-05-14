import { component$ } from "@qwik.dev/core";
import { useFooterMenuItems } from "~/routes/layout";
import { sanitizeSvg } from "~/utils/svg-sanitize";

export const SiteFooter = component$(() => {
  const footerItems = useFooterMenuItems();

  if (!Array.isArray(footerItems.value) || footerItems.value.length === 0) {
    return null;
  }

  const sortedItems = [...footerItems.value].sort((a, b) => a.position - b.position);
  const textLinks = sortedItems.filter((item) => !item.icon);
  const iconLinks = sortedItems.filter((item) => !!item.icon);

  return (
    <footer class="border-t border-gray-200 bg-white">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5">
        <div class="flex items-center justify-between gap-4 text-sm text-gray-600">
          <div class="flex flex-wrap items-center gap-x-6 gap-y-2">
            {textLinks.map((item) => (
              <a
                key={item.id}
                href={item.url}
                target={item.target}
                rel={item.target === "_blank" ? "noopener noreferrer" : undefined}
                class="hover:text-blue-600"
              >
                {item.label}
              </a>
            ))}
          </div>
          {iconLinks.length > 0 && (
            <div class="flex items-center gap-4">
              {iconLinks.map((item) => (
                <a
                  key={item.id}
                  href={item.url}
                  target={item.target}
                  rel={item.target === "_blank" ? "noopener noreferrer" : undefined}
                  title={item.label}
                  class="inline-flex items-center justify-center w-5 h-5 shrink-0 text-gray-500 hover:text-blue-600 [&_svg]:w-full [&_svg]:h-full [&_svg]:block"
                >
                  {(() => {
                    const svg = sanitizeSvg(item.icon!);
                    return svg ? (
                      <span
                        class="w-full h-full"
                        dangerouslySetInnerHTML={svg}
                      />
                    ) : (
                      <span class="text-[10px] font-semibold">{item.label}</span>
                    );
                  })()}
                </a>
              ))}
            </div>
          )}
        </div>
      </div>
    </footer>
  );
});
