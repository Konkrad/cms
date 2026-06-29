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
        color: "bg-success hover:bg-success text-white",
        activeColor: "bg-success",
      },
      {
        value: "maybe" as const,
        label: "? Maybe",
        color: "bg-warning hover:bg-warning text-white",
        activeColor: "bg-warning",
      },
      {
        value: "no" as const,
        label: "✗ Not Going",
        color: "bg-error hover:bg-error text-white",
        activeColor: "bg-error",
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
