import { component$ } from "@builder.io/qwik";
import { ReadMoreButton } from "../ReadMoreButton/ReadMoreButton";

interface BlogCardProps {
  image?: string;
  date?: string;
  category?: string;
  title?: string;
  description?: string;
  readMoreHref?: string;
}

const CLOCK_PATH_OUTER =
  "M6.6623 0C5.34462 0 4.05653 0.390737 2.96092 1.1228C1.86531 1.85486 1.01139 2.89537 0.507135 4.11275C0.00288128 5.33013 -0.129055 6.66969 0.128012 7.96205C0.385078 9.25442 1.0196 10.4415 1.95134 11.3733C2.88308 12.305 4.07019 12.9395 5.36255 13.1966C6.65491 13.4537 7.99448 13.3217 9.21185 12.8175C10.4292 12.3132 11.4697 11.4593 12.2018 10.3637C12.9339 9.26807 13.3246 7.97998 13.3246 6.6623C13.3227 4.89594 12.6202 3.20246 11.3712 1.95345C10.1221 0.704443 8.42867 0.00191046 6.6623 0V0ZM6.6623 12.2142C5.56424 12.2142 4.49083 11.8886 3.57782 11.2786C2.66481 10.6685 1.95321 9.80141 1.533 8.78693C1.11278 7.77245 1.00284 6.65615 1.21706 5.57918C1.43128 4.50221 1.96005 3.51295 2.7365 2.7365C3.51295 1.96005 4.50221 1.43128 5.57918 1.21706C6.65614 1.00284 7.77245 1.11279 8.78693 1.533C9.80141 1.95321 10.6685 2.66481 11.2786 3.57782C11.8886 4.49083 12.2142 5.56424 12.2142 6.6623C12.2126 8.13427 11.6272 9.54548 10.5863 10.5863C9.54548 11.6272 8.13427 12.2126 6.6623 12.2142V12.2142Z";

const CLOCK_PATH_HAND =
  "M6.66221 3.33115C6.51497 3.33115 6.37375 3.38965 6.26963 3.49376C6.16552 3.59788 6.10702 3.7391 6.10702 3.88634V6.28754L4.23547 7.46011C4.11031 7.5383 4.02134 7.663 3.98812 7.80679C3.95491 7.95058 3.98018 8.10167 4.05836 8.22683C4.13655 8.35199 4.26126 8.44096 4.40504 8.47417C4.54883 8.50739 4.69993 8.48212 4.82508 8.40393L6.95702 7.07147C7.03757 7.02101 7.10382 6.9507 7.14941 6.86729C7.195 6.78389 7.21841 6.69017 7.21741 6.59512V3.88634C7.21741 3.7391 7.15891 3.59788 7.05479 3.49376C6.95068 3.38965 6.80946 3.33115 6.66221 3.33115Z";

function formatBlogDate(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    return new Intl.DateTimeFormat("en-US", {
      day: "numeric",
      month: "long",
      year: "numeric",
    })
      .format(date)
      .toUpperCase();
  } catch {
    return "";
  }
}

export const BlogCard = component$<BlogCardProps>(
  ({
    image = "https://picsum.photos/450/220",
    date,
    category,
    title,
    description,
    readMoreHref = "#",
  }) => {
    const formattedDate = date ? formatBlogDate(date) : "";

    return (
      <div class="relative w-full max-w-[457px] rounded-lg overflow-hidden shadow-[0px_0px_6px_0px_rgba(0,0,0,0.06)] bg-white flex flex-col h-full">
        {/* Image Section */}
        <div class="relative h-[218px] w-full overflow-hidden flex-shrink-0">
          <img
            src={image}
            alt={title ?? ""}
            class="w-full h-full object-cover"
            width={457}
            height={218}
          />

          {/* Dark Overlay */}
          <div class="absolute bottom-0 left-0 right-0 h-[91px] bg-black/20" />

          {/* Text Overlay Content */}
          <div class="absolute left-[33px] right-[33px] bottom-[34px] flex flex-col gap-2">
            {/* Date and Clock Icon */}
            {formattedDate && (
              <div class="flex items-center gap-2">
                <div class="w-[13.3px] h-[13.3px]">
                  <svg
                    class="block w-full h-full"
                    fill="none"
                    viewBox="0 0 13.3246 13.3246"
                  >
                    <path d={CLOCK_PATH_OUTER} fill="white" />
                    <path d={CLOCK_PATH_HAND} fill="white" />
                  </svg>
                </div>
                <p class="text-white text-xs tracking-wide">{formattedDate}</p>
              </div>
            )}

            {/* Title */}
            {title && (
              <h3 class="text-white text-2xl truncate max-w-full">{title}</h3>
            )}
          </div>

          {/* Category */}
          {category && (
            <div class="absolute right-[34px] bottom-[34px]">
              <p class="text-white text-xs tracking-wide">{category}</p>
            </div>
          )}
        </div>

        {/* Description Section */}
        <div class="px-[34px] py-[30px] flex flex-col flex-1">
          {description && (
            <p class="text-black text-sm leading-relaxed mb-6 flex-1">
              {description}
            </p>
          )}

          {/* Read More Button */}
          <div class="mt-auto">
            <ReadMoreButton href={readMoreHref} />
          </div>
        </div>
      </div>
    );
  },
);
