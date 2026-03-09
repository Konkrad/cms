import { component$, Slot } from "@builder.io/qwik";
import { ReadMoreButton } from "./ReadMoreButton";

interface ListCardProps {
  image?: string | null;
  imageAlt?: string;
  title: string;
  readMoreHref?: string;
  readMoreLabel?: string;
}

export const ListCard = component$<ListCardProps>(
  ({
    image,
    imageAlt = "",
    title,
    readMoreHref = "#",
    readMoreLabel = "Read More",
  }) => {
    return (
      <div class="relative w-full bg-white rounded-[20px] shadow-[0px_0px_6px_0px_rgba(0,0,0,0.06)] overflow-hidden flex flex-row">
        {/* Left side: image */}
        {image && (
          <div class="w-[140px] sm:w-[160px] md:w-[180px] flex-shrink-0">
            <img
              src={image}
              alt={imageAlt || title}
              class="w-full h-full object-cover"
              width={180}
              height={200}
            />
          </div>
        )}

        {/* Content Area */}
        <div class="flex-1 flex flex-col py-5 px-5 sm:px-8 min-w-0">
          {/* Top row */}
          <div class="flex items-start justify-between gap-4">
            <Slot name="top-left" />
            <Slot name="top-right" />
          </div>

          {/* Subtitle beneath top row */}
          <Slot name="subtitle" />

          {/* Separator */}
          <div class="w-full h-px bg-black/10 my-3" />

          {/* Title */}
          <h3 class="font-['Lato',sans-serif] font-bold text-[18px] sm:text-[22px] md:text-[24px] leading-[1.3] text-black">
            {title}
          </h3>

          {/* Action Button */}
          <div class="mt-3">
            <ReadMoreButton href={readMoreHref} label={readMoreLabel} />
          </div>
        </div>
      </div>
    );
  },
);
