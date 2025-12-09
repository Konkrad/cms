import { component$, type QwikIntrinsicElements } from '@builder.io/qwik';

type InputProps = QwikIntrinsicElements['input'] & {
  label?: string;
  error?: string;
};

export const Input = component$<InputProps>(({ label, error, class: className, ...props }) => {
  return (
    <div class="flex flex-col gap-1">
      {label && (
        <label class="text-sm font-medium text-gray-700">
          {label}
          {props.required && <span class="text-red-500 ml-1">*</span>}
        </label>
      )}
      <input
        {...props}
        class={`px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
          error ? 'border-red-500' : 'border-gray-300'
        } ${className || ''}`}
      />
      {error && <span class="text-sm text-red-500">{error}</span>}
    </div>
  );
});
