import { component$ } from "@qwik.dev/core";

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
      <div class="bg-white rounded-lg shadow-sm p-6">
        <h3 class="text-lg font-semibold mb-4">Participation Summary</h3>
        <div class="grid grid-cols-3 gap-4">
          <div class="text-center">
            <div class="text-3xl font-bold text-green-600">{summary.yes}</div>
            <div class="text-sm text-gray-600">Going</div>
          </div>
          <div class="text-center">
            <div class="text-3xl font-bold text-yellow-600">
              {summary.maybe}
            </div>
            <div class="text-sm text-gray-600">Maybe</div>
          </div>
          <div class="text-center">
            <div class="text-3xl font-bold text-red-600">{summary.no}</div>
            <div class="text-sm text-gray-600">Not Going</div>
          </div>
        </div>
        <div class="mt-4 pt-4 border-t text-center">
          <div class="text-2xl font-bold text-gray-900">{summary.total}</div>
          <div class="text-sm text-gray-600">Total Responses</div>
        </div>
      </div>
    );
  },
);
