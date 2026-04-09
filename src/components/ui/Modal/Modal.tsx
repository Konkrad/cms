import { component$, type QRL, Slot } from "@builder.io/qwik";

type ModalProps = {
  open: boolean;
  onClose$: QRL<() => void>;
  title?: string;
  size?: "sm" | "md" | "lg" | "xl";
};

const sizeClasses = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-lg",
  xl: "max-w-xl",
};

export const Modal = component$<ModalProps>(
  ({ open, onClose$, title, size = "lg" }) => {
    if (!open) {
      return <div class="hidden" />;
    }

    return (
      <div
        class="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 px-4"
        onClick$={(e) => {
          if (e.target === e.currentTarget) {
            onClose$();
          }
        }}
      >
        <div
          class={`bg-white rounded-2xl shadow-2xl w-full ${sizeClasses[size]} max-h-[90vh] flex flex-col overflow-hidden`}
          onClick$={(e) => e.stopPropagation()}
        >
          {title && (
            <div class="flex items-center justify-between px-6 pt-6 pb-4">
              <h2 class="font-semibold text-xl text-text">{title}</h2>
              <button
                onClick$={onClose$}
                class="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors text-text-muted hover:text-text"
                aria-label="Close"
              >
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          )}
          <div class="overflow-y-auto flex-1 px-6 pb-6">
            <Slot />
          </div>
        </div>
      </div>
    );
  },
);
