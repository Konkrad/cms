import { component$ } from "@builder.io/qwik";

interface EventDateTileProps {
  startDate: Date;
  endDate: Date;
  size?: "sm" | "md";
  variant?: "blue" | "dark";
  area?: string;
  timezone?: string;
}

function formatDate(date: Date): string {
  const day = date.getDate();
  const suffix =
    day === 1 || day === 21 || day === 31
      ? "st"
      : day === 2 || day === 22
        ? "nd"
        : day === 3 || day === 23
          ? "rd"
          : "th";
  const formatter = new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
  });
  const parts = formatter.formatToParts(date);
  const month = parts.find((p) => p.type === "month")?.value;
  const year = parts.find((p) => p.type === "year")?.value;
  return `${day}${suffix} ${month} ${year}`;
}

function formatTime(date: Date, timezone: string = "Europe/Paris"): string {
  const formatter = new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: timezone,
    timeZoneName: "short",
    hour12: false,
  });
  return formatter.format(date);
}

const SIZE_CLASSES: Record<string, string> = {
  sm: "min-h-[240px]",
  md: "min-h-[280px]",
};

export const EventDateTile = component$<EventDateTileProps>((props) => {
  const bgClass =
    (props.variant ?? "blue") === "blue"
      ? "bg-[#034ea2]"
      : "bg-gradient-to-b from-[#0e1148] to-[#0f1330]";

  const sizeClass = SIZE_CLASSES[props.size ?? "md"];
  const tz = props.timezone ?? "Europe/Paris";

  const formattedStartDate = formatDate(props.startDate);
  const formattedStartTime = formatTime(props.startDate, tz);
  const formattedEndDate = formatDate(props.endDate);
  const formattedEndTime = formatTime(props.endDate, tz);

  return (
    <div
      class={`${bgClass} rounded-[25px] p-8 ${sizeClass}`}
      style={props.area ? { gridArea: props.area } : undefined}
    >
      <h3 class="font-['Rubik',sans-serif] font-semibold text-[30px] leading-[1.406] text-white mb-8">
        Save the Date
      </h3>

      {/* Date Range */}
      <div class="flex items-center gap-4 mb-6">
        <div class="flex flex-col">
          <p class="font-['Lato',sans-serif] font-bold text-[18px] leading-[1.348] text-white">
            {formattedStartDate}
          </p>
          <p class="font-['Lato',sans-serif] font-bold text-[18px] leading-[1.348] text-white">
            {formattedStartTime}
          </p>
        </div>

        {/* Arrow */}
        <div class="flex items-center justify-center w-[22px] h-[27px] opacity-70">
          <svg
            width="22"
            height="27"
            viewBox="0 0 22 27"
            fill="none"
            class="w-full h-full"
          >
            <path
              d="M4 3l14 10.5L4 24"
              stroke="#96C046"
              stroke-width="3"
              stroke-linecap="round"
              stroke-linejoin="round"
              fill="none"
            />
          </svg>
        </div>

        <div class="flex flex-col">
          <p class="font-['Lato',sans-serif] font-bold text-[18px] leading-[1.348] text-white">
            {formattedEndDate}
          </p>
          <p class="font-['Lato',sans-serif] font-bold text-[18px] leading-[1.348] text-white">
            {formattedEndTime}
          </p>
        </div>
      </div>

      {/* Add to Calendar Button */}
      <button class="flex items-center gap-2 group cursor-pointer bg-transparent border-none p-0">
        <div class="w-6 h-6 relative">
          <svg class="w-full h-full" fill="none" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="12" fill="url(#paint0_linear_calendar)" />
            <defs>
              <linearGradient
                id="paint0_linear_calendar"
                x1="30.05"
                y1="-3.19"
                x2="-8.71"
                y2="24"
                gradientUnits="userSpaceOnUse"
              >
                <stop stop-color="#96C046" />
                <stop offset="1" stop-color="#D2DF83" />
              </linearGradient>
            </defs>
          </svg>
          <div class="absolute inset-0 flex items-center justify-center">
            <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24">
              <path
                d="M19 4h-1V2h-2v2H8V2H6v2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V10h14v10zm0-12H5V6h14v2z"
                fill="white"
              />
            </svg>
          </div>
        </div>
        <span class="font-['Lato',sans-serif] font-bold text-[14px] leading-[1.348] text-white group-hover:underline">
          Add to Calendar
        </span>
      </button>
    </div>
  );
});
