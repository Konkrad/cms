import { component$ } from "@qwik.dev/core";
import type { NoteCardData } from "~/contracts/notes";
import { CardByline } from "~theme/shared/StreamList/CardByline";

/**
 * One note in a listing, a feed or under the item it is about: shown whole like a status
 * update. The byline (author · date) comes first, as on an article card. `note.body` is
 * sanitized server-side (the notes service).
 */
export const NoteCard = component$<{ note: NoteCardData }>(({ note }) => (
	<article
		class="flex flex-col gap-2 bg-bg-card border border-border p-4"
		data-stream-type="note"
	>
		<CardByline item={note} linked />
		<div
			class="prose max-w-none text-text"
			dangerouslySetInnerHTML={note.body}
		/>
	</article>
));
