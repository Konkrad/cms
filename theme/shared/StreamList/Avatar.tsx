import { component$ } from "@qwik.dev/core";

/** An author's round thumbnail, or their initial when they have none. */
export const Avatar = component$<{
	displayName: string;
	avatarUrl: string | null;
}>((props) =>
	props.avatarUrl ? (
		<img
			src={props.avatarUrl}
			alt=""
			width={44}
			height={44}
			class="w-11 h-11 object-cover rounded-full"
		/>
	) : (
		<span class="w-11 h-11 rounded-full bg-primary-dark flex items-center justify-center text-white font-semibold text-lg">
			{props.displayName.charAt(0).toUpperCase()}
		</span>
	),
);
