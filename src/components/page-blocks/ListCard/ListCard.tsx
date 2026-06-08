import { component$ } from "@qwik.dev/core";
import { ReadMoreButton } from "../ReadMoreButton/ReadMoreButton";

interface ListCardProps {
  image?: string | null;
  imageAlt?: string;
  title: string;
  date?: string;
  topRight?: string;
  description?: string;
  readMoreHref?: string;
  readMoreLabel?: string;
}

export const ListCard = component$<ListCardProps>(
  ({
    image,
    imageAlt = "",
    title,
    date,
    topRight,
    description,
    readMoreHref = "#",
    readMoreLabel = "Read More",
  }) => {
    return (
      <div class="w-full bg-white rounded-[20px] shadow-[0px_0px_6px_0px_rgba(0,0,0,0.06)] overflow-hidden">
        {/* Image with gradient overlay */}
        <div class="relative w-full" style={{ aspectRatio: "1/1" }}>
          {image ? (
            <img
              src={image}
              alt={imageAlt || title}
              class="w-full h-full object-cover"
            />
          ) : (
            <div class="w-full h-full bg-blue-700" />
          )}

          {/* Gradient overlay */}
          <div
            class="absolute inset-0"
            style={{
              background:
                "linear-gradient(to top, rgba(0,0,0,0.72) 0%, rgba(0,0,0,0.3) 45%, transparent 75%)",
            }}
          />

          {/* Date + category row */}
          {(date || topRight) && (
            <div class="absolute bottom-12 left-4 right-4 flex items-center justify-between gap-2">
              {date && (
                <span class="flex items-center gap-1 text-white/80 text-xs font-medium">
                  <svg class="w-3 h-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                      d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {date}
                </span>
              )}
              {topRight && (
                <span class="text-white/80 text-xs font-medium uppercase tracking-wide">
                  {topRight}
                </span>
              )}
            </div>
          )}

          {/* Title overlaid at bottom */}
          <div class="absolute bottom-0 left-0 right-0 px-4 pb-4">
            <h3 class="text-white font-bold text-xl leading-tight">
              {title}
            </h3>
          </div>
        </div>

        {/* Content below image */}
        <div class="px-4 py-4">
          {description && (
            <p class="text-gray-700 text-sm leading-relaxed mb-3">
              {description}
            </p>
          )}
          <ReadMoreButton href={readMoreHref} label={readMoreLabel} />
        </div>
      </div>
    );
  },
);
