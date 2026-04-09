import { component$, type QwikIntrinsicElements, Slot } from "@builder.io/qwik";

type ButtonProps = QwikIntrinsicElements["button"] & {
	variant?: "primary" | "secondary" | "danger";
};

export const Button = component$<ButtonProps>(
	({ variant = "primary", class: className, ...props }) => {
		const variantClasses = {
			primary: "bg-primary hover:bg-primary-light text-white",
			secondary: "bg-gray-200 hover:bg-gray-300 text-gray-800",
			danger: "bg-danger hover:bg-danger-dark text-white",
		};

		return (
			<button
				{...props}
				class={`px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${variantClasses[variant]} ${className || ""}`}
			>
				<Slot />
			</button>
		);
	},
);
