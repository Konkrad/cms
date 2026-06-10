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
				<div class="relative">
					<select
						{...props}
						class={`w-full appearance-none px-3 py-2 pr-9 border rounded-lg bg-white focus:outline-hidden focus:ring-2 focus:ring-focus-ring ${
							error ? "border-error" : "border-border-strong"
						} ${className || ""}`}
					>
						<Slot />
					</select>
					<div class="pointer-events-none absolute inset-y-0 right-3 flex items-center">
						<svg class="h-4 w-4 text-text-secondary" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
							<path d="M4 6l4 4 4-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
						</svg>
					</div>
				</div>
				{error && <span class="text-sm text-error">{error}</span>}
			</div>
		);
	},
);
