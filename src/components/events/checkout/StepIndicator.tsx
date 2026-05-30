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
            currentStep === 1 ? "bg-blue-600 text-white" : "bg-green-600 text-white"
          }`}
        >
          {currentStep > 1 ? "✓" : "1"}
        </div>
        <span class={`ml-2 font-medium ${currentStep === 1 ? "text-blue-600" : "text-gray-600"}`}>
          Select Products
        </span>
      </div>

      <div class="w-24 h-1 bg-gray-300 mx-4"></div>

      <div class="flex items-center">
        <div
          class={`flex items-center justify-center w-10 h-10 rounded-full ${
            currentStep === 2
              ? "bg-blue-600 text-white"
              : currentStep > 2
                ? "bg-green-600 text-white"
                : "bg-gray-300 text-gray-600"
          }`}
        >
          2
        </div>
        <span class={`ml-2 font-medium ${currentStep === 2 ? "text-blue-600" : "text-gray-600"}`}>
          Participants
        </span>
      </div>

      <div class="w-24 h-1 bg-gray-300 mx-4"></div>

      <div class="flex items-center">
        <div
          class={`flex items-center justify-center w-10 h-10 rounded-full ${
            currentStep === 3
              ? "bg-blue-600 text-white"
              : currentStep > 3
                ? "bg-green-600 text-white"
                : "bg-gray-300 text-gray-600"
          }`}
        >
          3
        </div>
        <span class={`ml-2 font-medium ${currentStep === 3 ? "text-blue-600" : "text-gray-600"}`}>
          Payment
        </span>
      </div>
    </div>
  );
});
