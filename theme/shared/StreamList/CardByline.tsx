import { component$ } from "@qwik.dev/core";
import type { StreamItemData } from "~/contracts/stream";
import { cardMeta } from "~theme/shared/StreamList/card-meta";

/**
 * The first line of every stream card, the same for notes and articles: author · date · source
 * scope · visibility. With `linked`, the author links to their profile and the date to the item
 * (a note card); without, both are plain text (an article card is one link already).
 */
export const CardByline = component$<{
	item: StreamItemData;
	linked?: boolean;
}>(({ item, linked }) => (
	<p class="text-xs text-text-muted">
		{linked ? (
			<a
				href={item.author.profileUrl}
				class="font-semibold text-text-heading hover:text-primary"
			>
				{item.author.displayName}
			</a>
		) : (
			<span class="font-semibold text-text-heading">
				{item.author.displayName}
			</span>
		)}
		{" · "}
		{linked ? (
			<a href={item.url} class="hover:text-primary">
				<time dateTime={item.publishedAt}>{cardMeta(item)}</time>
			</a>
		) : (
			<time dateTime={item.publishedAt}>{cardMeta(item)}</time>
		)}
	</p>
));
