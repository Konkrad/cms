import { component$, type QRL } from "@qwik.dev/core";

interface ParticipationToggleProps {
  currentStatus: "yes" | "no" | "maybe" | null;
  onStatusChange?: QRL<(status: "yes" | "no" | "maybe") => void>;
  disabled?: boolean;
}

export const ParticipationToggle = component$<ParticipationToggleProps>(
  ({ currentStatus, onStatusChange, disabled = false }) => {
    const statuses = [
      {
        value: "yes" as const,
        label: "✓ Going",
        color: "bg-green-600 hover:bg-green-700 text-white",
        activeColor: "bg-green-700",
      },
      {
        value: "maybe" as const,
        label: "? Maybe",
        color: "bg-yellow-600 hover:bg-yellow-700 text-white",
        activeColor: "bg-yellow-700",
      },
      {
        value: "no" as const,
        label: "✗ Not Going",
        color: "bg-red-600 hover:bg-red-700 text-white",
        activeColor: "bg-red-700",
      },
    ];

    return (
      <div class="flex gap-2 flex-wrap">
        {statuses.map((status) => {
          const isActive = currentStatus === status.value;
          return (
            <button
              key={status.value}
              type="submit"
              name="status"
              value={status.value}
              disabled={disabled}
              onClick$={() => onStatusChange?.(status.value)}
              class={`
                px-4 py-2 rounded-lg font-medium transition-all
                ${isActive ? status.activeColor : status.color}
                ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}
                ${isActive ? "ring-2 ring-offset-2 ring-current" : ""}
              `}
            >
              {status.label}
            </button>
          );
        })}
      </div>
    );
  },
);
