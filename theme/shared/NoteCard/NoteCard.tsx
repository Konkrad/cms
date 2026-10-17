import { component$ } from "@qwik.dev/core";
import type { NoteCardData } from "~/contracts/notes";
import { cardMeta } from "~theme/shared/StreamList/card-meta";

/**
 * One note in a listing, a feed or under the item it is about: shown whole like a status
 * update, its author first. `note.body` is sanitized server-side (the notes service).
 */
export const NoteCard = component$<{ note: NoteCardData }>(({ note }) => (
	<article
		class="flex flex-col gap-3 bg-bg-card border border-border p-4"
		data-stream-type="note"
	>
		<header class="flex items-baseline justify-between gap-3">
			<a
				href={note.author.profileUrl}
				class="font-semibold text-text-heading hover:text-primary"
			>
				{note.author.displayName}
			</a>
			<a href={note.url} class="text-xs text-text-muted hover:text-primary">
				<time dateTime={note.publishedAt}>{cardMeta(note)}</time>
			</a>
		</header>
		<div
			class="prose max-w-none text-text"
			dangerouslySetInnerHTML={note.body}
		/>
	</article>
));
