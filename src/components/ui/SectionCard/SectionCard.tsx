import { component$, Slot } from "@builder.io/qwik";

type SectionCardProps = {
  title: string;
  headerRight?: string;
  class?: string;
};

export const SectionCard = component$<SectionCardProps>(
  ({ title, class: className }) => {
    return (
      <div class={`bg-white rounded-lg shadow-md p-6 ${className || ""}`}>
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-xl font-semibold">{title}</h3>
          <Slot name="header-right" />
        </div>
        <Slot />
      </div>
    );
  },
);
