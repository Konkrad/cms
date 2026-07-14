import { component$, $ } from "@qwik.dev/core";

interface EventDateTileProps {
  startDate: Date;
  endDate: Date;
  variant?: "blue" | "dark";
  area?: string;
  timezone?: string;
  title?: string;
  location?: string;
  description?: string;
  isPast?: boolean;
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

function toICalDateString(date: Date): string {
  const pad = (n: number) => n.toString().padStart(2, "0");
  return (
    date.getUTCFullYear().toString() +
    pad(date.getUTCMonth() + 1) +
    pad(date.getUTCDate()) +
    "T" +
    pad(date.getUTCHours()) +
    pad(date.getUTCMinutes()) +
    pad(date.getUTCSeconds()) +
    "Z"
  );
}

function escapeICalText(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n");
}

export const EventDateTile = component$<EventDateTileProps>((props) => {
  const bgClass =
    (props.variant ?? "blue") === "blue"
      ? "bg-[#034ea2]"
      : "bg-linear-to-b from-[#0e1148] to-[#0f1330]";

  const tz = props.timezone ?? "Europe/Paris";
  const isPast = props.isPast ?? false;

  const formattedStartDate = formatDate(props.startDate);
  const formattedStartTime = formatTime(props.startDate, tz);
  const formattedEndDate = formatDate(props.endDate);
  const formattedEndTime = formatTime(props.endDate, tz);

  const downloadIcal = $(() => {
    const dtStart = toICalDateString(new Date(props.startDate));
    const dtEnd = toICalDateString(new Date(props.endDate));
    const uid = `${dtStart}-${dtEnd}@event`;
    const now = toICalDateString(new Date());

    const summary = escapeICalText(props.title || "Event");
    const location = props.location ? escapeICalText(props.location) : "";
    const description = props.description
      ? escapeICalText(props.description)
      : "";

    const lines = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//CMS//Events//EN",
      "CALSCALE:GREGORIAN",
      "METHOD:PUBLISH",
      "BEGIN:VEVENT",
      `UID:${uid}`,
      `DTSTAMP:${now}`,
      `DTSTART:${dtStart}`,
      `DTEND:${dtEnd}`,
      `SUMMARY:${summary}`,
    ];

    if (location) {
      lines.push(`LOCATION:${location}`);
    }
    if (description) {
      lines.push(`DESCRIPTION:${description}`);
    }

    lines.push("END:VEVENT", "END:VCALENDAR");

    const content = lines.join("\r\n");
    const blob = new Blob([content], {
      type: "text/calendar;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download =
      (props.title || "event").replace(/[^a-zA-Z0-9_-]/g, "_") + ".ics";
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  });

  return (
    <div
      class={`${bgClass} rounded-[25px] p-8 h-full`}
      style={props.area ? { gridArea: props.area } : undefined}
    >
      <h3 class="font-semibold text-[30px] leading-[1.406] text-white mb-8">
        Save the Date
      </h3>

      {/* Date Range */}
      <div class="flex items-center gap-4 mb-6">
        <div class="flex flex-col">
          <p class="font-bold text-[18px] leading-[1.348] text-white">
            {formattedStartDate}
          </p>
          <p class="font-bold text-[18px] leading-[1.348] text-white">
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
          <p class="font-bold text-[18px] leading-[1.348] text-white">
            {formattedEndDate}
          </p>
          <p class="font-bold text-[18px] leading-[1.348] text-white">
            {formattedEndTime}
          </p>
        </div>
      </div>

      {/* Add to Calendar Button — hidden for past events */}
      {!isPast && (
        <button
          onClick$={downloadIcal}
          class="flex items-center gap-2 group cursor-pointer bg-transparent border-none p-0"
        >
          <span class="w-6 h-6 relative inline-flex">
            <svg class="w-full h-full" fill="none" viewBox="0 0 24 24">
              <circle
                cx="12"
                cy="12"
                r="12"
                fill="url(#paint0_linear_calendar)"
              />
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
            <span class="absolute inset-0 flex items-center justify-center">
              <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24">
                <path
                  d="M19 4h-1V2h-2v2H8V2H6v2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V10h14v10zm0-12H5V6h14v2z"
                  fill="white"
                />
              </svg>
            </span>
          </span>
          <span class="font-bold text-[14px] leading-[1.348] text-white group-hover:underline">
            Add to Calendar
          </span>
        </button>
      )}
    </div>
  );
});
