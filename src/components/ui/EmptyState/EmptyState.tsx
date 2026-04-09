import { component$, Slot } from "@builder.io/qwik";

type EmptyStateProps = {
  message: string;
  description?: string;
  class?: string;
};

export const EmptyState = component$<EmptyStateProps>(
  ({ message, description, class: className }) => {
    return (
      <div class={`text-center py-12 text-text-muted ${className || ""}`}>
        <Slot />
        <p class="text-lg font-medium">{message}</p>
        {description && <p class="text-sm mt-1">{description}</p>}
      </div>
    );
  },
);
