import { $, component$, type QRL, useSignal } from "@qwik.dev/core";
import { Input } from "~/components/ui/Input";
import { useLinkSearch } from "~/core/refs/useLinkSearch";

/**
 * A page-builder `link` field: an external URL typed in, or an internal page picked from the
 * search below, stored as a reference (`ref:…`) so it follows renames and moves.
 */
export const LinkField = component$<{
	name: string;
	label: string;
	value: string;
	placeholder?: string;
	required?: boolean;
	onChange$: QRL<(value: string) => void>;
}>((props) => {
	const { results, isLoading, search$ } = useLinkSearch();
	const query = useSignal("");
	const picked = useSignal<string | null>(null);

	return (
		<div class="space-y-1" data-testid={`link-field-${props.name}`}>
			<Input
				name={props.name}
				label={props.label}
				type="text"
				value={props.value}
				placeholder={props.placeholder ?? "https://… or pick a page below"}
				required={props.required}
				onInput$={(e) => {
					picked.value = null;
					void props.onChange$((e.target as HTMLInputElement).value);
				}}
			/>
			{picked.value && (
				<p class="text-xs text-gray-500">Links to {picked.value}</p>
			)}
			<input
				type="search"
				class="w-full border rounded-sm px-2 py-1 text-xs"
				placeholder="Find a page, group or item…"
				aria-label={`Find an internal link for ${props.label}`}
				value={query.value}
				onInput$={$(async (e: Event) => {
					query.value = (e.target as HTMLInputElement).value;
					await search$(query.value);
				})}
			/>
			{isLoading.value && <p class="text-xs text-gray-400">Searching…</p>}
			{results.value.length > 0 && (
				<ul class="border rounded-sm divide-y max-h-48 overflow-y-auto text-xs">
					{results.value.map((r) => (
						<li key={r.href}>
							<button
								type="button"
								class="w-full text-left px-2 py-1 hover:bg-gray-50"
								onClick$={async () => {
									picked.value = `${r.label} (${r.url})`;
									results.value = [];
									query.value = "";
									await props.onChange$(r.href);
								}}
							>
								{r.label}
								<span class="block text-gray-400">{r.url}</span>
							</button>
						</li>
					))}
				</ul>
			)}
		</div>
	);
});
