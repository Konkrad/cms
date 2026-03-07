import { component$ } from "@builder.io/qwik";

interface LocalRepTileProps {
  name: string;
  subtitle: string;
  profilePictureUrl: string | null;
  profileUrl: string;
  area?: string;
}

export const LocalRepTile = component$<LocalRepTileProps>((props) => {
  return (
    <div
      class="bg-[#034ea2] rounded-[25px] p-8 flex flex-col justify-between h-full"
      style={props.area ? { gridArea: props.area } : undefined}
    >
      <h3 class="font-['Rubik',sans-serif] font-semibold text-[30px] leading-[1.406] text-white">
        Local Rep
      </h3>

      <div class="flex items-center gap-4 my-6">
        {props.profilePictureUrl ? (
          <img
            src={props.profilePictureUrl}
            alt={props.name}
            width={56}
            height={56}
            class="w-14 h-14 rounded-full object-cover flex-shrink-0"
          />
        ) : (
          <div class="w-14 h-14 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
            <span class="text-white text-xl font-bold">
              {props.name.charAt(0).toUpperCase()}
            </span>
          </div>
        )}
        <div>
          <p class="font-['Lato',sans-serif] font-bold text-[16px] leading-[1.348] text-white">
            {props.name}
          </p>
          <p class="font-['Lato',sans-serif] text-[14px] text-white/70 leading-snug">
            {props.subtitle}
          </p>
        </div>
      </div>

      <a href={props.profileUrl} class="flex items-center gap-2 group cursor-pointer">
        <div class="w-6 h-6 relative flex-shrink-0">
          <svg class="w-full h-full" fill="none" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="12" fill="url(#paint0_linear_rep)" />
            <defs>
              <linearGradient id="paint0_linear_rep" x1="30.05" y1="-3.19" x2="-8.71" y2="24" gradientUnits="userSpaceOnUse">
                <stop stop-color="#96C046" />
                <stop offset="1" stop-color="#D2DF83" />
              </linearGradient>
            </defs>
          </svg>
          <div class="absolute inset-0 flex items-center justify-center">
            <svg class="w-3 h-3" fill="white" viewBox="0 0 24 24">
              <path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z" />
            </svg>
          </div>
        </div>
        <span class="font-['Lato',sans-serif] font-bold text-[14px] leading-[1.348] text-white group-hover:underline">
          Visit Profile
        </span>
      </a>
    </div>
  );
});
