import { component$ } from "@qwik.dev/core";
import { CursorPager } from "~/components/ui/CursorPager";
import type { BlockDefinition } from "~/contracts/blocks";
import type { StreamFilter } from "~/contracts/stream";
import { useStream } from "~/core/content/builder/blocks/useStream";
import { StreamList } from "~theme/shared/StreamList/StreamList";

interface StreamBlockProps {
	limit?: number;
	show?: StreamFilter;
}

const EMPTY: Record<StreamFilter, string> = {
	all: "No news yet.",
	notes: "No notes yet.",
	articles: "No articles yet.",
};

export const definition: BlockDefinition = {
	name: "Stream",
	componentType: "StreamBlock",
	category: "dynamic",
	icon: "📰",
	configSchema: [
		{
			name: "show",
			label: "Show",
			type: "select",
			defaultValue: "all",
			options: [
				{ label: "Notes and articles", value: "all" },
				{ label: "Notes only (short stream)", value: "notes" },
				{ label: "Articles only", value: "articles" },
			],
		},
		{
			name: "limit",
			label: "Items per page",
			type: "number",
			defaultValue: 10,
		},
	],
	defaultData: {
		show: "all",
		limit: 10,
	},
};

/** The page's scope stream: notes and articles newest first, or one type (`show`). */
export default component$<StreamBlockProps>((props) => {
	const show = props.show ?? "all";
	const { items, nextCursor, prevCursor, isLoading, error, goNext, goPrev } =
		useStream(props.limit ?? 10, show);

	return (
		<div class="max-w-6xl mx-auto px-4 py-12" data-stream-show={show}>
			{isLoading.value && items.value.length === 0 ? (
				<div class="text-center py-12">
					<p class="text-text-muted">Loading…</p>
				</div>
			) : error.value ? (
				<p class="text-error text-center py-8">Failed to load: {error.value}</p>
			) : items.value.length === 0 ? (
				<p class="text-text-muted text-center py-8">{EMPTY[show]}</p>
			) : (
				<>
					<StreamList items={items.value} />

					<CursorPager
						hasPrevious={prevCursor.value !== null}
						hasNext={nextCursor.value !== null}
						isLoading={isLoading.value}
						onPrevious$={goPrev}
						onNext$={goNext}
					/>
				</>
			)}
		</div>
	);
});
