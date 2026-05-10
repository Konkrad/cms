import { component$, type QwikIntrinsicElements } from "@qwik.dev/core";

type TextAreaProps = QwikIntrinsicElements["textarea"] & {
	label?: string;
	error?: string;
};

export const TextArea = component$<TextAreaProps>(
	({ label, error, class: className, ...props }) => {
		return (
			<div class="flex flex-col gap-1">
				{label && (
					<label class="text-sm font-medium text-text">
						{label}
						{props.required && <span class="text-error ml-1">*</span>}
					</label>
				)}
				<textarea
					{...props}
					class={`px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-focus-ring resize-y ${
						error ? "border-error" : "border-border-strong"
					} ${className || ""}`}
				/>
				{error && <span class="text-sm text-error">{error}</span>}
			</div>
		);
	},
);
