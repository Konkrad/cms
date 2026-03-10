import { component$ } from "@builder.io/qwik";

interface ActionButtonProps {
  href: string;
  label: string;
}

export const ActionButton = component$<ActionButtonProps>(
  ({ href, label }) => {
    return (
      <a
        href={href}
        class="inline-flex items-center rounded-[10px] bg-[#96C247] px-[40px] py-[18px] font-['Lato',sans-serif] text-[20px] font-bold text-white shadow-[0_4px_6px_rgba(0,0,0,0.1)] transition-transform hover:scale-105"
      >
        {label}
      </a>
    );
  },
);
