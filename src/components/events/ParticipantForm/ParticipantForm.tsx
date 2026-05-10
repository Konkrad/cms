import { component$, type Signal } from "@builder.io/qwik";
import { Input } from "~/components/ui/Input";

interface ParticipantData {
  name: string;
  email: string;
  phone?: string;
}

interface ParticipantFormProps {
  participantNumber: number;
  participantData: Signal<ParticipantData>;
}

export const ParticipantForm = component$<ParticipantFormProps>(
  ({ participantNumber, participantData }) => {
    return (
      <div class="border rounded-lg p-4 space-y-4">
        <h3 class="font-semibold text-lg">
          Participant {participantNumber}
        </h3>
        
        <Input
          name={`participant_${participantNumber}_name`}
          label="Full Name"
          required
          value={participantData.value.name}
          onInput$={(e, el) => {
            participantData.value = {
              ...participantData.value,
              name: el.value,
            };
          }}
          placeholder="John Doe"
        />

        <Input
          name={`participant_${participantNumber}_email`}
          label="Email"
          type="email"
          required
          value={participantData.value.email}
          onInput$={(e, el) => {
            participantData.value = {
              ...participantData.value,
              email: el.value,
            };
          }}
          placeholder="john@example.com"
        />

        <Input
          name={`participant_${participantNumber}_phone`}
          label="Phone (optional)"
          type="tel"
          value={participantData.value.phone || ""}
          onInput$={(e, el) => {
            participantData.value = {
              ...participantData.value,
              phone: el.value,
            };
          }}
          placeholder="+1 234 567 8900"
        />
      </div>
    );
  },
);

interface ParticipantsCollectionProps {
  capacity: number;
  participants: Signal<ParticipantData[]>;
}

export const ParticipantsCollection = component$<ParticipantsCollectionProps>(
  ({ capacity, participants }) => {
    return (
      <div class="space-y-4">
        <div class="mb-4">
          <h2 class="text-xl font-bold">Participant Details</h2>
          <p class="text-sm text-gray-600">
            This product requires information for {capacity}{" "}
            {capacity === 1 ? "participant" : "participants"}
          </p>
        </div>

        {Array.from({ length: capacity }, (_, i) => (
          <ParticipantForm
            key={i}
            participantNumber={i + 1}
            participantData={
              {
                get value() {
                  return participants.value[i] || { name: "", email: "", phone: "" };
                },
                set value(v) {
                  const newParticipants = [...participants.value];
                  newParticipants[i] = v;
                  participants.value = newParticipants;
                },
              } as Signal<ParticipantData>
            }
          />
        ))}
      </div>
    );
  },
);
