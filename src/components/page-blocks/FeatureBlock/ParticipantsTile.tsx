import { component$ } from "@builder.io/qwik";

interface ParticipantsTileProps {
  participantImages: string[];
  leadParticipant?: string;
  otherCount: number;
  eventName?: string;
  variant?: "blue" | "dark";
  area?: string;
}

export const ParticipantsTile = component$<ParticipantsTileProps>((props) => {
  const bgClass =
    (props.variant ?? "blue") === "blue"
      ? "bg-[#034ea2]"
      : "bg-gradient-to-b from-[#0e1148] to-[#0f1330]";

  const leadName = props.leadParticipant ?? "Dolor Satium, Catarina";
  const evtName = props.eventName ?? "CONNECT";

  return (
    <div
      class={`${bgClass} rounded-[25px] p-8 h-full`}
      style={props.area ? { gridArea: props.area } : undefined}
    >
      <h3 class="font-['Rubik',sans-serif] font-semibold text-[30px] leading-[1.406] text-white mb-6">
        Participants
      </h3>

      {/* Participant Avatars */}
      <div class="flex items-center gap-2 mb-4">
        {props.participantImages.slice(0, 3).map((img, index) => (
          <img
            key={index}
            src={img}
            alt={`Participant ${index + 1}`}
            class="w-[38px] h-[38px] rounded-full object-cover"
            width={38}
            height={38}
          />
        ))}
      </div>

      {/* Participant Text */}
      <div class="space-y-1">
        <p class="font-['Lato',sans-serif] font-bold text-[16px] leading-[1.348] text-white text-center">
          {leadName}
          <span class="font-normal"> and</span>
        </p>
        <p class="font-['Lato',sans-serif] text-[16px] leading-[1.348] text-white text-center">
          <span class="font-bold">{props.otherCount} others</span>
          <span class="font-normal"> are going to</span>
        </p>
        <p class="font-['Lato',sans-serif] font-bold text-[16px] leading-[1.348] text-white text-center">
          {evtName}
        </p>
      </div>

      {/* See All Button */}
      <button class="flex items-center gap-2 group mt-6 cursor-pointer bg-transparent border-none p-0">
        <div class="w-6 h-6 relative">
          <svg class="w-full h-full" fill="none" viewBox="0 0 24 24">
            <circle
              cx="12"
              cy="12"
              r="12"
              fill="url(#paint0_linear_participants)"
            />
            <defs>
              <linearGradient
                id="paint0_linear_participants"
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
                d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"
                fill="white"
              />
            </svg>
          </div>
        </div>
        <span class="font-['Lato',sans-serif] font-bold text-[14px] leading-[1.348] text-white group-hover:underline">
          See All Participants
        </span>
      </button>
    </div>
  );
});
