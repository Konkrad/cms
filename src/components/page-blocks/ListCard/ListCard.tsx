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
      <>
        {/* ── Mobile card (< md) ── */}
        <div class="md:hidden w-full bg-white rounded-[20px] shadow-[0px_0px_6px_0px_rgba(0,0,0,0.06)] overflow-hidden">
          {image && (
            <div class="relative w-full" style={{ aspectRatio: "1/1" }}>
              <img
                src={image}
                alt={imageAlt || title}
                class="w-full h-full object-cover"
              />
              <div
                class="absolute inset-0"
                style={{
                  background:
                    "linear-gradient(to top, rgba(0,0,0,0.72) 0%, rgba(0,0,0,0.3) 45%, transparent 75%)",
                }}
              />
              {(date || topRight) && (
                <div class="absolute bottom-10 left-4 right-4 flex items-center justify-between gap-2">
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
              <div class="absolute bottom-0 left-0 right-0 px-4 pb-3">
                <h3 class="text-white font-bold text-xl leading-tight line-clamp-1">
                  {title}
                </h3>
              </div>
            </div>
          )}
          <div class="px-4 py-4">
            {!image && (
              <>
                <h3 class="font-bold text-lg text-gray-900 leading-snug mb-1 truncate">
                  {title}
                </h3>
                {(date || topRight) && (
                  <div class="flex items-center justify-between gap-2 mb-2">
                    {date && (
                      <span class="flex items-center gap-1 text-gray-500 text-xs font-medium">
                        <svg class="w-3 h-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                            d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        {date}
                      </span>
                    )}
                    {topRight && (
                      <span class="text-gray-500 text-xs font-medium uppercase tracking-wide">
                        {topRight}
                      </span>
                    )}
                  </div>
                )}
              </>
            )}
            {description && (
              <p class="text-gray-700 text-sm leading-relaxed mb-3">{description}</p>
            )}
            <ReadMoreButton href={readMoreHref} label={readMoreLabel} />
          </div>
        </div>

        {/* ── Tablet / Desktop card (≥ md) ── */}
        <div class="hidden md:flex w-full bg-white rounded-[20px] shadow-[0px_0px_6px_0px_rgba(0,0,0,0.06)] overflow-hidden flex-row">
          {image && (
            <div class="w-[160px] lg:w-[180px] shrink-0">
              <img
                src={image}
                alt={imageAlt || title}
                class="w-full h-full object-cover"
                width={180}
                height={180}
              />
            </div>
          )}
          <div class="flex-1 flex flex-col py-5 px-6 min-w-0">
            {(date || topRight) && (
              <div class="flex items-start justify-between gap-4">
                {date ? (
                  <p class="font-['Lato',sans-serif] font-normal text-[13px] leading-[1.4] text-gray-500 mt-0.5">
                    {date}
                  </p>
                ) : (
                  <div />
                )}
                {topRight && (
                  <p class="font-['Lato',sans-serif] font-normal text-[14px] leading-[1.4] text-black text-right">
                    {topRight}
                  </p>
                )}
              </div>
            )}
            <div class="w-full h-px bg-black/10 my-3" />
            <h3 class="font-['Lato',sans-serif] font-bold text-[20px] lg:text-[24px] leading-[1.3] text-black truncate">
              {title}
            </h3>
            {description && (
              <p class="font-['Lato',sans-serif] font-normal text-[15px] leading-normal text-gray-700 mt-2">
                {description}
              </p>
            )}
            <div class="mt-3">
              <ReadMoreButton href={readMoreHref} label={readMoreLabel} />
            </div>
          </div>
        </div>
      </>
    );
  },
);
