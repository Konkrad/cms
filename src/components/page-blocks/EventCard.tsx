import { component$ } from "@builder.io/qwik";
import { ReadMoreButton } from "./ReadMoreButton";

interface EventCardProps {
  date: string;
  title: string;
  location: string;
  image?: string;
  readMoreHref?: string;
}

const LOCATION_PIN_OUTER =
  "M8.49995 17.0002C7.90349 17.0033 7.31498 16.8634 6.7837 16.5922C6.25242 16.3211 5.79383 15.9266 5.44632 15.4419C2.74686 11.7182 1.37765 8.91882 1.37765 7.12107C1.37765 5.23212 2.12804 3.42054 3.46373 2.08485C4.79941 0.749164 6.611 -0.00121813 8.49995 -0.00121813C10.3889 -0.00121813 12.2005 0.749164 13.5362 2.08485C14.8719 3.42054 15.6222 5.23212 15.6222 7.12107C15.6222 8.91882 14.253 11.7182 11.5536 15.4419C11.2061 15.9266 10.7475 16.3211 10.2162 16.5922C9.68491 16.8634 9.0964 17.0033 8.49995 17.0002V17.0002ZM8.49995 1.54507C7.02124 1.54676 5.60358 2.13492 4.55798 3.18052C3.51238 4.22613 2.92422 5.64379 2.92253 7.12249C2.92253 8.54624 4.2634 11.1791 6.69724 14.5359C6.90385 14.8205 7.17492 15.0521 7.48824 15.2118C7.80157 15.3716 8.14826 15.4548 8.49995 15.4548C8.85163 15.4548 9.19832 15.3716 9.51165 15.2118C9.82498 15.0521 10.096 14.8205 10.3027 14.5359C12.7365 11.1791 14.0774 8.54624 14.0774 7.12249C14.0757 5.64379 13.4875 4.22613 12.4419 3.18052C11.3963 2.13492 9.97865 1.54676 8.49995 1.54507V1.54507Z";

const LOCATION_PIN_INNER =
  "M8.50007 4.25C7.93969 4.25 7.3919 4.41617 6.92596 4.7275C6.46002 5.03883 6.09686 5.48134 5.88241 5.99906C5.66796 6.51679 5.61186 7.08648 5.72118 7.63609C5.8305 8.1857 6.10035 8.69055 6.4966 9.0868C6.89285 9.48305 7.3977 9.7529 7.94732 9.86223C8.49693 9.97155 9.06662 9.91544 9.58434 9.70099C10.1021 9.48654 10.5446 9.12339 10.8559 8.65745C11.1672 8.19151 11.3334 7.64371 11.3334 7.08333C11.3334 6.33189 11.0349 5.61122 10.5035 5.07986C9.97219 4.54851 9.25152 4.25 8.50007 4.25ZM8.50007 8.5C8.21988 8.5 7.94598 8.41691 7.71301 8.26125C7.48004 8.10558 7.29847 7.88433 7.19124 7.62547C7.08402 7.36661 7.05596 7.08176 7.11063 6.80696C7.16529 6.53215 7.30021 6.27972 7.49834 6.0816C7.69646 5.88347 7.94889 5.74855 8.22369 5.69389C8.4985 5.63922 8.78334 5.66728 9.04221 5.7745C9.30107 5.88173 9.52232 6.06331 9.67799 6.29628C9.83365 6.52925 9.91674 6.80314 9.91674 7.08333C9.91674 7.45906 9.76748 7.81939 9.50181 8.08507C9.23613 8.35074 8.8758 8.5 8.50007 8.5Z";

function formatDay(dateStr: string): string {
  try {
    return new Intl.DateTimeFormat("en-US", { day: "numeric" }).format(
      new Date(dateStr),
    );
  } catch {
    return "";
  }
}

function formatMonth(dateStr: string): string {
  try {
    return new Intl.DateTimeFormat("en-US", { month: "long" }).format(
      new Date(dateStr),
    );
  } catch {
    return "";
  }
}

function formatTime(dateStr: string): string {
  try {
    return new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }).format(new Date(dateStr));
  } catch {
    return "";
  }
}

export const EventCard = component$<EventCardProps>(
  ({ date, title, location, image, readMoreHref = "#" }) => {
    const day = formatDay(date);
    const month = formatMonth(date);
    const time = formatTime(date);

    return (
      <div class="relative w-full bg-white rounded-[25px] shadow-[0px_0px_6px_0px_rgba(0,0,0,0.06)] h-[200px] flex items-center">
        {/* Optional Image on Left */}
        {image && (
          <div class="w-[200px] h-full rounded-l-[25px] overflow-hidden flex-shrink-0">
            <img
              src={image}
              alt={title}
              class="w-full h-full object-cover"
              width={200}
              height={200}
            />
          </div>
        )}

        {/* Content Area */}
        <div
          class={`flex-1 flex items-center px-8 ${image ? "pl-10" : "pl-16"}`}
        >
          {/* Date Section */}
          <div class="flex flex-col items-start min-w-[170px]">
            <p class="font-['Lato',sans-serif] font-semibold text-[40px] leading-[1.523] text-black">
              {day}
            </p>
            <p class="font-['Lato',sans-serif] font-bold text-[20px] leading-[1.523] text-black">
              {month}
            </p>
            <p class="font-['Lato',sans-serif] font-medium text-[13px] leading-[1.523] text-black">
              {time}
            </p>
          </div>

          {/* Divider Line */}
          <div class="h-24 w-px bg-black/20 mx-8" />

          {/* Title and Location */}
          <div class="flex-1 flex flex-col justify-center gap-4">
            <h3 class="font-['Lato',sans-serif] font-bold text-[26px] leading-[1.359] text-black">
              {title}
            </h3>

            <div class="flex items-center gap-2">
              <svg
                class="w-[17px] h-[17px] flex-shrink-0"
                fill="none"
                viewBox="0 0 17 17"
              >
                <path d={LOCATION_PIN_INNER} fill="black" />
                <path d={LOCATION_PIN_OUTER} fill="black" />
              </svg>
              <p class="font-['Lato',sans-serif] font-normal text-[15px] leading-[1.523] text-black">
                {location}
              </p>
            </div>
          </div>

          {/* Read More Button */}
          <div class="ml-8 flex-shrink-0">
            <ReadMoreButton href={readMoreHref} />
          </div>
        </div>
      </div>
    );
  },
);
