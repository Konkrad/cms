import { component$, type QRL } from "@builder.io/qwik";
import type { ParticipantData } from "~/components/page-blocks/FeatureBlock/ParticipantsTile";

interface ParticipantsModalProps {
  participants: ParticipantData[];
  eventName: string;
  onClose$: QRL<() => void>;
}

export const ParticipantsModal = component$<ParticipantsModalProps>(
  ({ participants, eventName, onClose$ }) => {
    return (
      <div
        class="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 px-4"
        onClick$={(e) => {
          if (e.target === e.currentTarget) {
            onClose$();
          }
        }}
      >
        <div class="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col overflow-hidden">
          {/* Header */}
          <div class="flex items-center justify-between px-6 pt-6 pb-4">
            <h2 class="font-['Rubik',sans-serif] font-semibold text-[20px] text-black">
              Participants {eventName.toUpperCase()}
            </h2>
            <button
              onClick$={onClose$}
              class="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors text-gray-500 hover:text-gray-800"
              aria-label="Close"
            >
              <svg
                class="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          {/* Participant list */}
          <div class="overflow-y-auto flex-1 px-6 pb-6">
            {participants.length === 0 ? (
              <p class="text-gray-500 text-center py-8">No participants yet.</p>
            ) : (
              <ul class="divide-y divide-gray-200">
                {participants.map((p) => {
                  const subtitle = [
                    p.groupLabel,
                    [p.city, p.country].filter(Boolean).join(", "),
                  ]
                    .filter(Boolean)
                    .join(", ");

                  return (
                    <li
                      key={p.id}
                      class="flex items-center gap-4 py-4 first:pt-0"
                    >
                      {/* Avatar */}
                      {p.profilePictureSmallUrl ? (
                        <img
                          src={p.profilePictureSmallUrl}
                          alt={p.displayName}
                          width={48}
                          height={48}
                          class="w-12 h-12 rounded-full object-cover border-2 border-gray-200 flex-shrink-0"
                        />
                      ) : (
                        <div class="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0 border-2 border-gray-200">
                          <span class="text-gray-500 font-semibold text-base">
                            {p.displayName.charAt(0).toUpperCase()}
                          </span>
                        </div>
                      )}

                      {/* Name & subtitle */}
                      <div class="min-w-0">
                        <p class="font-semibold text-[15px] text-gray-900 truncate">
                          {p.displayName}
                        </p>
                        {subtitle && (
                          <p class="text-[13px] text-gray-500 truncate">
                            {subtitle}
                          </p>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      </div>
    );
  },
);
