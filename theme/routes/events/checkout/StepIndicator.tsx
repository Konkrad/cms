import { component$ } from "@qwik.dev/core";

type StepIndicatorProps = {
  currentStep: 1 | 2 | 3 | 4;
};

export const StepIndicator = component$<StepIndicatorProps>(({ currentStep }) => {
  return (
    <div class="flex items-center justify-center mb-8">
      <div class="flex items-center">
        <div
          class={`flex items-center justify-center w-10 h-10 rounded-full ${
            currentStep === 1 ? "bg-primary text-white" : "bg-success text-white"
          }`}
        >
          {currentStep > 1 ? "✓" : "1"}
        </div>
        <span class={`ml-2 font-medium ${currentStep === 1 ? "text-primary" : "text-text-secondary"}`}>
          Select Products
        </span>
      </div>

      <div class="w-24 h-1 bg-border-strong mx-4"></div>

      <div class="flex items-center">
        <div
          class={`flex items-center justify-center w-10 h-10 rounded-full ${
            currentStep === 2
              ? "bg-primary text-white"
              : currentStep > 2
                ? "bg-success text-white"
                : "bg-border-strong text-text-secondary"
          }`}
        >
          2
        </div>
        <span class={`ml-2 font-medium ${currentStep === 2 ? "text-primary" : "text-text-secondary"}`}>
          Participants
        </span>
      </div>

      <div class="w-24 h-1 bg-border-strong mx-4"></div>

      <div class="flex items-center">
        <div
          class={`flex items-center justify-center w-10 h-10 rounded-full ${
            currentStep === 3
              ? "bg-primary text-white"
              : currentStep > 3
                ? "bg-success text-white"
                : "bg-border-strong text-text-secondary"
          }`}
        >
          3
        </div>
        <span class={`ml-2 font-medium ${currentStep === 3 ? "text-primary" : "text-text-secondary"}`}>
          Payment
        </span>
      </div>
    </div>
  );
});
