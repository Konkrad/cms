import { component$, type QwikIntrinsicElements, Slot } from "@qwik.dev/core";

type SelectProps = QwikIntrinsicElements["select"] & {
	label?: string;
	error?: string;
};

export const Select = component$<SelectProps>(
	({ label, error, class: className, ...props }) => {
		return (
			<div class="flex flex-col gap-1">
				{label && (
					<label class="text-sm font-medium text-text">
						{label}
						{props.required && <span class="text-error ml-1">*</span>}
					</label>
				)}
				<select
					{...props}
					class={`px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-focus-ring bg-white ${
						error ? "border-error" : "border-border-strong"
					} ${className || ""}`}
				>
					<Slot />
				</select>
				{error && <span class="text-sm text-error">{error}</span>}
			</div>
		);
	},
);
