import { component$, useSignal } from "@qwik.dev/core";
import { t } from "~/core/i18n";
import { useLinkSearch } from "~/core/refs/useLinkSearch";

/** Module items (`ref:<module>:<type>:<id>`), not scopes, listings or core pages, notes and articles. */
const SUBJECT_HREF_RE = /^ref:(?!scope:|core:)[a-z][a-z0-9-]*:[a-z][a-z0-9-]*:/;

/**
 * Picks the item a note or an article is about (an event) from the link search (spec 4.3), as a reference.
 * Posts it as `subject` (`ref:<module>:<type>:<id>`, empty = none).
 */
export const SubjectPicker = component$<{
	value: { href: string; label: string } | null;
}>((props) => {
	const { results, isLoading, search$ } = useLinkSearch();
	const query = useSignal("");
	const selected = useSignal(props.value);
	const items = results.value.filter((r) => SUBJECT_HREF_RE.test(r.href));
	return (
		<div class="space-y-2" data-testid="subject-picker">
			<span class="block text-sm font-medium text-gray-700">
				{t("admin.subjectPicker.aboutOptional")}
			</span>
			<input type="hidden" name="subject" value={selected.value?.href ?? ""} />
			{selected.value ? (
				<div class="flex items-center gap-3 text-sm">
					<span class="font-medium text-gray-900">{selected.value.label}</span>
					<button
						type="button"
						class="text-red-600 hover:text-red-800"
						onClick$={() => {
							selected.value = null;
						}}
					>
						{t("admin.subjectPicker.remove")}
					</button>
				</div>
			) : (
				<>
					<input
						type="search"
						class="w-full border rounded-sm px-2 py-1 text-sm"
						placeholder={t("admin.subjectPicker.searchAnEventOrAnother")}
						aria-label={t("admin.subjectPicker.findTheItemThisIs")}
						value={query.value}
						onInput$={async (e) => {
							query.value = (e.target as HTMLInputElement).value;
							await search$(query.value);
						}}
					/>
					{isLoading.value && (
						<p class="text-xs text-gray-400">
							{t("admin.subjectPicker.searching")}
						</p>
					)}
					{items.length > 0 && (
						<ul class="border rounded-sm divide-y max-h-48 overflow-y-auto bg-white">
							{items.map((r) => (
								<li key={r.href}>
									<button
										type="button"
										class="w-full text-left px-2 py-1 hover:bg-gray-50"
										onClick$={() => {
											selected.value = { href: r.href, label: r.label };
											results.value = [];
											query.value = "";
										}}
									>
										{r.label}
										<span class="block text-xs text-gray-400">{r.url}</span>
									</button>
								</li>
							))}
						</ul>
					)}
				</>
			)}
		</div>
	);
});
