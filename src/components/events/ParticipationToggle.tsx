import { component$, type Signal } from "@builder.io/qwik";
import { Button } from "~/components/ui/Button";

interface ParticipationToggleProps {
  currentStatus: "yes" | "no" | "maybe" | null;
  onStatusChange: (status: "yes" | "no" | "maybe") => void;
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
              type="button"
              disabled={disabled}
              onClick$={() => onStatusChange(status.value)}
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

interface ParticipationSummaryProps {
  summary: {
    yes: number;
    no: number;
    maybe: number;
    total: number;
  };
}

export const ParticipationSummary = component$<ParticipationSummaryProps>(
  ({ summary }) => {
    return (
      <div class="bg-white rounded-lg shadow p-6">
        <h3 class="text-lg font-semibold mb-4">Participation Summary</h3>
        <div class="grid grid-cols-3 gap-4">
          <div class="text-center">
            <div class="text-3xl font-bold text-green-600">
              {summary.yes}
            </div>
            <div class="text-sm text-gray-600">Going</div>
          </div>
          <div class="text-center">
            <div class="text-3xl font-bold text-yellow-600">
              {summary.maybe}
            </div>
            <div class="text-sm text-gray-600">Maybe</div>
          </div>
          <div class="text-center">
            <div class="text-3xl font-bold text-red-600">
              {summary.no}
            </div>
            <div class="text-sm text-gray-600">Not Going</div>
          </div>
        </div>
        <div class="mt-4 pt-4 border-t text-center">
          <div class="text-2xl font-bold text-gray-900">
            {summary.total}
          </div>
          <div class="text-sm text-gray-600">Total Responses</div>
        </div>
      </div>
    );
  },
);
