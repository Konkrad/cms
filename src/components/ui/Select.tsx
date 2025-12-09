import { component$, Slot, type QwikIntrinsicElements } from '@builder.io/qwik';

type SelectProps = QwikIntrinsicElements['select'] & {
  label?: string;
  error?: string;
};

export const Select = component$<SelectProps>(({ label, error, class: className, ...props }) => {
  return (
    <div class="flex flex-col gap-1">
      {label && (
        <label class="text-sm font-medium text-gray-700">
          {label}
          {props.required && <span class="text-red-500 ml-1">*</span>}
        </label>
      )}
      <select
        {...props}
        class={`px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white ${
          error ? 'border-red-500' : 'border-gray-300'
        } ${className || ''}`}
      >
        <Slot />
      </select>
      {error && <span class="text-sm text-red-500">{error}</span>}
    </div>
  );
});
