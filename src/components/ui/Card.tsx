import { component$, Slot, type QwikIntrinsicElements } from '@builder.io/qwik';

type CardProps = QwikIntrinsicElements['div'] & {
  hover?: boolean;
};

export const Card = component$<CardProps>(({ hover = false, class: className, ...props }) => {
  return (
    <div
      {...props}
      class={`bg-white rounded-lg shadow-md p-6 ${hover ? 'hover:shadow-lg transition-shadow' : ''} ${className || ''}`}
    >
      <Slot />
    </div>
  );
});
