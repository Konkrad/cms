import { component$ } from "@builder.io/qwik";

interface GroupStatsTileProps {
  memberCount: number;
  eventCount: number;
  membersUrl: string;
  area?: string;
}

export const GroupStatsTile = component$<GroupStatsTileProps>((props) => {
  return (
    <div
      class="bg-[#034ea2] rounded-[25px] p-8 flex flex-col justify-between h-full"
      style={props.area ? { gridArea: props.area } : undefined}
    >
      <div>
        <p class="font-['Rubik',sans-serif] font-normal text-[50px] leading-[1.1] text-white">
          {props.memberCount}
        </p>
        <h3 class="font-['Rubik',sans-serif] font-semibold text-[24px] leading-[1.406] text-white mt-1">
          Community Members
        </h3>
      </div>
      <div class="mt-6">
        <p class="font-['Rubik',sans-serif] font-normal text-[36px] leading-[1.1] text-white">
          {props.eventCount}
        </p>
        <p class="font-['Rubik',sans-serif] font-semibold text-[18px] leading-[1.406] text-white mt-1">
          Local Meet-Ups
        </p>
      </div>
      <a href={props.membersUrl} class="flex items-center gap-2 group cursor-pointer mt-6">
        <div class="w-6 h-6 relative flex-shrink-0">
          <svg class="w-full h-full" fill="none" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="12" fill="url(#paint0_linear_members)" />
            <defs>
              <linearGradient id="paint0_linear_members" x1="30.05" y1="-3.19" x2="-8.71" y2="24" gradientUnits="userSpaceOnUse">
                <stop stop-color="#96C046" />
                <stop offset="1" stop-color="#D2DF83" />
              </linearGradient>
            </defs>
          </svg>
          <div class="absolute inset-0 flex items-center justify-center">
            <svg class="w-3 h-3" fill="white" viewBox="0 0 24 24">
              <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z" />
            </svg>
          </div>
        </div>
        <span class="font-['Lato',sans-serif] font-bold text-[14px] leading-[1.348] text-white group-hover:underline">
          See All Members
        </span>
      </a>
    </div>
  );
});
