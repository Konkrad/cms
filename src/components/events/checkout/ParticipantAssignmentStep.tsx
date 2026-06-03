import { component$, $ } from "@qwik.dev/core";
import { Button } from "~/components/ui/Button";
import { ParticipantForm } from "~/components/events/ParticipantForm";
import type { GroupedAssignments, ParticipantAssignmentUnit } from "./types";

type ParticipantAssignmentStepProps = {
  groupedAssignments: GroupedAssignments[];
  assignments: ParticipantAssignmentUnit[];
  buyer: {
    name: string;
    avatarUrl: string | null;
  };
  error?: string;
  onBack$: () => void;
  onContinue$: () => void;
  onAssignmentsChange$: (next: ParticipantAssignmentUnit[]) => void;
};

export const ParticipantAssignmentStep = component$<ParticipantAssignmentStepProps>(
  ({ groupedAssignments, assignments, buyer, error, onBack$, onContinue$, onAssignmentsChange$ }) => {
    return (
      <div class="space-y-6">
        <div>
          <h2 class="text-xl font-bold mb-1">Participant Assignment</h2>
          <p class="text-sm text-gray-600">
            Search for participants to assign to each ticket.
          </p>
        </div>

        {groupedAssignments.map((productGroup) => {
          const flatSlots = productGroup.units.flatMap((unit) => unit.slots);
          const totalSlots = flatSlots.length;
          const assignedCount = flatSlots.filter(
            (s) => s.name || s.existingUserId,
          ).length;

          // Participants assigned to other products — quick-pick suggestions
          const seen = new Set<string>();
          const previouslyAdded = assignments
            .filter((u) => u.productId !== productGroup.productId)
            .flatMap((u) => u.slots)
            .filter((s) => s.name || s.existingUserId)
            .filter((s) => {
              const key = s.existingUserId ?? `${s.name}|${s.email}`;
              if (seen.has(key)) return false;
              seen.add(key);
              return true;
            });

          const handleSlotsChange = $((newFlatSlots: typeof flatSlots) => {
            // Distribute the flat slot list back into each unit's slots
            let offset = 0;
            const nextAssignments = assignments.map((u) => {
              if (u.productId !== productGroup.productId) return u;
              const unitSlots = newFlatSlots.slice(offset, offset + u.slots.length);
              offset += u.slots.length;
              return { ...u, slots: unitSlots };
            });
            onAssignmentsChange$(nextAssignments);
          });

          return (
            <div
              key={productGroup.productId}
              class="border rounded-lg p-6 bg-white space-y-4"
            >
              <div class="flex items-baseline justify-between">
                <h3 class="text-lg font-semibold">{productGroup.productName}</h3>
                <span class="text-sm text-gray-500">
                  {assignedCount}/{totalSlots} assigned
                </span>
              </div>

              <ParticipantForm
                slots={flatSlots}
                totalSlots={totalSlots}
                buyer={buyer}
                previouslyAdded={previouslyAdded}
                onSlotsChange$={handleSlotsChange}
              />
            </div>
          );
        })}

        <div class="sticky bottom-0 bg-white border-t pt-4 pb-2">
          {error && <p class="text-sm text-red-600 mb-3">{error}</p>}
          <div class="flex gap-4">
            <Button
              type="button"
              variant="secondary"
              class="flex-1"
              onClick$={onBack$}
            >
              Back to Products
            </Button>
            <Button type="button" class="flex-1" onClick$={onContinue$}>
              Continue to Payment
            </Button>
          </div>
        </div>
      </div>
    );
  },
);
