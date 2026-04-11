import { component$, type QRL } from "@builder.io/qwik";
import { formatUserName } from "~/utils/users";
import type { ParticipantData } from "~/components/page-blocks/FeatureBlock/ParticipantsTile";
import { Modal } from "~/components/ui/Modal";
import { Avatar } from "~/components/ui/Avatar";

interface ParticipantsModalProps {
  participants: ParticipantData[];
  eventName: string;
  onClose$: QRL<() => void>;
}

export const ParticipantsModal = component$<ParticipantsModalProps>(
  ({ participants, eventName, onClose$ }) => {
    return (
      <Modal open={true} onClose$={onClose$} title={`Participants — ${eventName}`}>
        {participants.length === 0 ? (
          <p class="text-gray-500 text-center py-8">No participants yet.</p>
        ) : (
          <ul class="divide-y divide-gray-200">
            {participants.map((p) => {
              const displayName = formatUserName(p);
              const subtitle = [
                p.groupLabel,
                [p.city, p.country].filter(Boolean).join(", "),
              ]
                .filter(Boolean)
                .join(", ");

              const inner = (
                <>
                  <Avatar
                    src={p.profilePictureSmall}
                    name={displayName}
                    size="md"
                  />
                  <div class="min-w-0">
                    <p class="font-semibold text-[15px] text-gray-900 truncate">{displayName}</p>
                    {subtitle && (
                      <p class="text-[13px] text-gray-500 truncate">{subtitle}</p>
                    )}
                  </div>
                </>
              );

              return (
                <li key={p.id} class="py-4 first:pt-0">
                  {p.profileUrl ? (
                    <a
                      href={p.profileUrl}
                      class="flex items-center gap-4 hover:bg-gray-50 rounded-xl transition-colors -mx-2 px-2"
                    >
                      {inner}
                    </a>
                  ) : (
                    <div class="flex items-center gap-4">{inner}</div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Modal>
    );
  },
);
