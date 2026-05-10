import { component$, type QwikIntrinsicElements, Slot } from "@qwik.dev/core";

type ButtonProps = QwikIntrinsicElements["button"] & {
	variant?: "primary" | "secondary" | "danger";
	size?: "sm" | "md" | "lg" | "xl";
	href?: string;
};

export const Button = component$<ButtonProps>(
	({ variant = "primary", size = "md", href, class: className, ...props }) => {
		const variantClasses = {
			primary: "bg-primary hover:bg-primary-dark text-white",
			secondary: "bg-gray-200 hover:bg-gray-300 text-gray-800",
			danger: "bg-danger hover:bg-danger-dark text-white",
		};

		const sizeClasses = {
			sm: "px-3 py-1.5 text-sm",
			md: "px-6 py-2",
			lg: "px-8 py-3 text-lg",
			xl: "px-10 py-4 text-xl",
		};

		const classes = `inline-flex items-center justify-center rounded-lg font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed ${sizeClasses[size]} ${variantClasses[variant]} ${className || ""}`;

		if (href) {
			return (
				<a href={href} class={classes}>
					<Slot />
				</a>
			);
		}

		return (
			<button
				{...props}
				class={classes}
			>
				<Slot />
			</button>
		);
	},
);
