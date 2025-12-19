import { component$, type QwikIntrinsicElements, Slot } from "@builder.io/qwik";

type ButtonProps = QwikIntrinsicElements["button"] & {
	variant?: "primary" | "secondary" | "danger";
};

export const Button = component$<ButtonProps>(
	({ variant = "primary", class: className, ...props }) => {
		const variantClasses = {
			primary: "bg-blue-500 hover:bg-blue-600 text-white",
			secondary: "bg-gray-200 hover:bg-gray-300 text-gray-800",
			danger: "bg-red-500 hover:bg-red-600 text-white",
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
