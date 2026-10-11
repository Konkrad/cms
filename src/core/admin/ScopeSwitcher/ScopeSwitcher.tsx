import { component$ } from "@qwik.dev/core";
import { Link } from "@qwik.dev/router";

export interface ScopeSwitcherItem {
	id: string;
	label: string;
	kind: string;
	/** Path depth (root = 0), for indentation. */
	depth: number;
	href: string;
}

/** Jump to the admin of another scope the user manages (a plain <details> menu, no JS needed). */
export const ScopeSwitcher = component$<{
	current: string;
	scopes: ScopeSwitcherItem[];
}>(({ current, scopes }) => {
	if (scopes.length < 2) return null;
	return (
		<details class="relative" data-testid="scope-switcher">
			<summary class="list-none cursor-pointer rounded border border-slate-500 px-3 py-1.5 text-sm text-slate-100 hover:bg-slate-700">
				Switch group ▾
			</summary>
			<ul class="absolute right-0 z-20 mt-1 max-h-80 w-64 overflow-y-auto rounded-lg border border-gray-200 bg-white py-1 text-sm text-gray-800 shadow-lg">
				{scopes.map((s) => (
					<li key={s.id}>
						<Link
							href={s.href}
							class={`block py-1.5 pr-3 hover:bg-gray-50 ${s.id === current ? "font-semibold" : ""}`}
							style={{ paddingLeft: `${0.75 + s.depth}rem` }}
						>
							{s.label}
							<span class="ml-1 text-xs text-gray-400">{s.kind}</span>
						</Link>
					</li>
				))}
			</ul>
		</details>
	);
});
