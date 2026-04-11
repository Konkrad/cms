import { component$, Slot } from "@builder.io/qwik";

type BadgeVariant = "default" | "success" | "warning" | "error" | "info";

type BadgeProps = {
  variant?: BadgeVariant;
  class?: string;
};

const variantClasses: Record<BadgeVariant, string> = {
  default: "bg-gray-100 text-gray-800",
  success: "bg-green-100 text-green-800",
  warning: "bg-yellow-100 text-yellow-800",
  error: "bg-red-100 text-red-800",
  info: "bg-blue-100 text-blue-800",
};

export const Badge = component$<BadgeProps>(
  ({ variant = "default", class: className }) => {
    return (
      <span
        class={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${variantClasses[variant]} ${className || ""}`}
      >
        <Slot />
      </span>
    );
  },
);
