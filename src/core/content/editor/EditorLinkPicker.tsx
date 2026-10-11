import { component$, type QRL, useSignal } from "@qwik.dev/core";
import { useLinkSearch } from "~/core/refs/useLinkSearch";

/**
 * "Link to…" bar above the rich text editor: search internal targets and link the selected
 * text to one as a `ref:` reference (spec 4.3), so the link follows renames and moves.
 */
export const EditorLinkPicker = component$<{
	onPick$: QRL<(href: string, label: string) => void>;
}>((props) => {
	const { results, isLoading, search$ } = useLinkSearch();
	const query = useSignal("");
	return (
		<div class="mb-2 text-sm" data-testid="editor-link-picker">
			<input
				type="search"
				class="w-full border rounded-sm px-2 py-1 text-sm"
				placeholder="Link the selected text to a page, group or item…"
				aria-label="Find an internal link"
				value={query.value}
				onInput$={async (e) => {
					query.value = (e.target as HTMLInputElement).value;
					await search$(query.value);
				}}
			/>
			{isLoading.value && <p class="text-xs text-gray-400">Searching…</p>}
			{results.value.length > 0 && (
				<ul class="border rounded-sm divide-y max-h-48 overflow-y-auto bg-white">
					{results.value.map((r) => (
						<li key={r.href}>
							<button
								type="button"
								class="w-full text-left px-2 py-1 hover:bg-gray-50"
								onClick$={async () => {
									results.value = [];
									query.value = "";
									await props.onPick$(r.href, r.label);
								}}
							>
								{r.label}
								<span class="block text-xs text-gray-400">{r.url}</span>
							</button>
						</li>
					))}
				</ul>
			)}
		</div>
	);
});
