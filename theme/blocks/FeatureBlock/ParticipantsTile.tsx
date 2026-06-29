import { component$, type QRL } from "@qwik.dev/core";
import { formatUserName } from "~/utils/users";

export interface ParticipantData {
  id: string;
  name: string;
  familyName: string;
  profilePictureSmall: string | null;
  groupLabel?: string | null;
  city?: string | null;
  country?: string | null;
  profileUrl?: string | null;
}

interface ParticipantsTileProps {
  participants: ParticipantData[];
  participantCount: number;
  title?: string;
  seeAllLabel?: string;
  seeAllHref?: string;
  emptyTitle?: string;
  emptyBody?: string;
  summaryLine?: string;
  variant?: "blue" | "dark";
  area?: string;
  isLoggedIn?: boolean;
  onSeeAll$?: QRL<() => void>;
}

export const ParticipantsTile = component$<ParticipantsTileProps>((props) => {
  const bgClass =
    (props.variant ?? "blue") === "blue"
      ? "bg-[#034ea2]"
      : "bg-linear-to-b from-[#0e1148] to-[#0f1330]";

  const count = props.participantCount;
  const hasEnough = count >= 5;
  const displayParticipants = props.participants.slice(0, 5);

  const title = props.title ?? "Participants";
  const seeAllLabel = props.seeAllLabel ?? "See All Participants";
  const emptyTitle = props.emptyTitle ?? "Be the first one!";
  const emptyBody = props.emptyBody ?? "Join and invite your friends";

  return (
    <div
      class={`${bgClass} rounded-[25px] p-8 h-full flex flex-col justify-between`}
      style={props.area ? { gridArea: props.area } : undefined}
    >
      <h3 class="font-['Rubik',sans-serif] font-semibold text-[30px] leading-[1.406] text-white mb-6">
        {title}
      </h3>

      {hasEnough ? (
        <>
          {/* Stacked avatar row */}
          <div class="flex items-center mb-4">
            {displayParticipants.map((p, index) => {
              const displayName = formatUserName(p);
              return (
                <div
                  key={p.id}
                  class="relative rounded-full border-2 border-[#0e1148]"
                  style={{
                    marginLeft: index === 0 ? "0" : "-10px",
                    zIndex: displayParticipants.length - index,
                  }}
                >
                  {p.profilePictureSmall ? (
                    <img
                      src={p.profilePictureSmall}
                      alt={displayName}
                      width={38}
                      height={38}
                      class="w-[38px] h-[38px] rounded-full object-cover"
                    />
                  ) : (
                    // Fixed bg-bg-muted: avatar placeholder on blue background needs specific contrast value, must not vary by theme
                    <div class="w-[38px] h-[38px] rounded-full bg-bg-muted flex items-center justify-center text-white text-xs font-semibold">
                      {displayName.charAt(0).toUpperCase()}
                    </div>
                  )}
                </div>
              );
            })}
            {count > 5 && (
              <div
                class="relative rounded-full border-2 border-[#0e1148] bg-white/20 w-[38px] h-[38px] flex items-center justify-center"
                style={{ marginLeft: "-10px", zIndex: 0 }}
              >
                <span class="text-white text-xs font-bold">+{count - 5}</span>
              </div>
            )}
          </div>

          <div class="space-y-1 mb-2">
            <p class="font-['Lato',sans-serif] font-bold text-[16px] leading-[1.348] text-white">
              {displayParticipants[0] && formatUserName(displayParticipants[0])}
              <span class="font-normal"> and</span>
            </p>
            <p class="font-['Lato',sans-serif] text-[16px] leading-[1.348] text-white">
              <span class="font-bold">{count - 1} others</span>
            </p>
            {props.summaryLine && (
              <p class="font-['Lato',sans-serif] text-[16px] leading-[1.348] text-white">
                {props.summaryLine}
              </p>
            )}
          </div>
        </>
      ) : (
        <div class="flex-1 flex flex-col justify-center items-center text-center py-4">
          <div class="w-16 h-16 mb-4 rounded-full bg-white/10 flex items-center justify-center">
            <svg class="w-8 h-8 text-white/60" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 1 1-8 0 4 4 0 0 1 8 0ZM3 20a6 6 0 0 1 12 0v1H3v-1Z" />
            </svg>
          </div>
          <p class="font-['Lato',sans-serif] font-bold text-[18px] text-white mb-1">{emptyTitle}</p>
          <p class="font-['Lato',sans-serif] text-[14px] text-white/70 leading-snug">{emptyBody}</p>
        </div>
      )}

      {props.isLoggedIn && hasEnough && (
        <>
          {props.seeAllHref ? (
            <a href={props.seeAllHref} class="flex items-center gap-2 group mt-4 cursor-pointer">
              <SeeAllIcon />
              <span class="font-['Lato',sans-serif] font-bold text-[14px] leading-[1.348] text-white group-hover:underline">
                {seeAllLabel}
              </span>
            </a>
          ) : props.onSeeAll$ ? (
            <button
              onClick$={props.onSeeAll$}
              class="flex items-center gap-2 group mt-4 cursor-pointer bg-transparent border-none p-0"
            >
              <SeeAllIcon />
              <span class="font-['Lato',sans-serif] font-bold text-[14px] leading-[1.348] text-white group-hover:underline">
                {seeAllLabel}
              </span>
            </button>
          ) : null}
        </>
      )}
    </div>
  );
});

const SeeAllIcon = component$(() => (
  <span class="w-6 h-6 relative shrink-0 inline-flex">
    <svg class="w-full h-full" fill="none" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="12" fill="url(#paint0_linear_participants)" />
      <defs>
        <linearGradient id="paint0_linear_participants" x1="30.05" y1="-3.19" x2="-8.71" y2="24" gradientUnits="userSpaceOnUse">
          <stop stop-color="#96C046" />
          <stop offset="1" stop-color="#D2DF83" />
        </linearGradient>
      </defs>
    </svg>
    <span class="absolute inset-0 flex items-center justify-center">
      <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24">
        <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z" fill="white" />
      </svg>
    </span>
  </span>
));
