import { component$, type QwikIntrinsicElements, Slot } from "@qwik.dev/core";

type CardProps = QwikIntrinsicElements["div"] & {
	hover?: boolean;
};

export const Card = component$<CardProps>(
	({ hover = false, class: className, ...props }) => {
		return (
			<div
				{...props}
				class={`bg-white rounded-lg shadow-md p-6 ${hover ? "hover:shadow-lg transition-shadow" : ""} ${className || ""}`}
			>
				<Slot />
			</div>
		);
	},
);
