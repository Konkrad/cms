import { component$, Slot } from "@qwik.dev/core";

type AlertVariant = "success" | "error" | "info" | "warning";

type AlertProps = {
  variant: AlertVariant;
  class?: string;
};

const variantClasses: Record<AlertVariant, string> = {
  success: "bg-green-50 border-green-200 text-green-800",
  error: "bg-red-100 border-red-300 text-red-700",
  info: "bg-blue-50 border-blue-200 text-blue-800",
  warning: "bg-yellow-50 border-yellow-200 text-yellow-800",
};

export const Alert = component$<AlertProps>(
  ({ variant, class: className }) => {
    return (
      <div
        class={`p-4 rounded-lg border ${variantClasses[variant]} ${className || ""}`}
      >
        <Slot />
      </div>
    );
  },
);
