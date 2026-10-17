import { component$ } from "@qwik.dev/core";
import type { StreamItemData } from "~/contracts/stream";
import { ArticleCard } from "~theme/shared/ArticleCard/ArticleCard";
import { NoteCard } from "~theme/shared/NoteCard/NoteCard";

/** One stream item: a note (`NoteCard`) or an article (`ArticleCard`), by its `type`. */
export const StreamCard = component$<{ item: StreamItemData }>(({ item }) =>
	item.type === "note" ? (
		<NoteCard note={item} />
	) : (
		<ArticleCard article={item} />
	),
);

/** The items of one listing, notes and articles mixed in one column-balanced grid. */
export const StreamList = component$<{ items: StreamItemData[] }>(
	({ items }) => (
		<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 items-start">
			{items.map((item) => (
				<StreamCard key={`${item.type}:${item.id}`} item={item} />
			))}
		</div>
	),
);
