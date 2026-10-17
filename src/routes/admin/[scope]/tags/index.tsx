import { component$ } from "@qwik.dev/core";
import { Form, routeAction$, routeLoader$, z, zod$ } from "@qwik.dev/router";
import { t } from "~/core/i18n";
import { requireSystemAdmin } from "~/core/scopes/access";
import { userTagsService } from "~/core/tags/user-tags.service";

export const useTagsData = routeLoader$(async (event) => {
	await requireSystemAdmin(event);
	const definitions = await userTagsService.getDefinitions();
	return { definitions };
});

export const useCreateDefinition = routeAction$(
	async (data, event) => {
		await requireSystemAdmin(event);
		await userTagsService.createDefinition(data as any);
		return { success: true };
	},
	zod$({
		slug: z
			.string()
			.min(1)
			.regex(/^[a-z0-9-]+$/, t("admin.tags.slugFormat")),
		label: z.string().min(1),
		category: z.enum(["board", "qualification", "participation", "custom"]),
		description: z.string().optional(),
	}),
);

export const useDeleteDefinition = routeAction$(
	async (data, event) => {
		await requireSystemAdmin(event);
		await userTagsService.deleteDefinition(data.definitionId);
		return { success: true };
	},
	zod$({ definitionId: z.string().uuid() }),
);

const CATEGORY_COLORS: Record<string, string> = {
	board: "bg-purple-100 text-purple-800",
	qualification: "bg-blue-100 text-blue-800",
	participation: "bg-green-100 text-green-800",
	custom: "bg-gray-100 text-gray-700",
};

export default component$(() => {
	const data = useTagsData();
	const createAction = useCreateDefinition();
	const deleteAction = useDeleteDefinition();

	return (
		<div>
			<div class="flex items-center justify-between mb-6">
				<h2 class="text-2xl font-bold text-gray-800">
					{t("admin.tags.tagDefinitions")}
				</h2>
			</div>
			<p class="text-sm text-gray-500 mb-6">
				{t("admin.tags.defineTheTagsThatCan")}
			</p>

			{createAction.value?.failed && (
				<div class="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
					{String(
						(createAction.value as any).fieldErrors ??
							t("admin.tags.somethingWentWrong"),
					)}
				</div>
			)}

			<div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
				{/* Existing definitions */}
				<div class="bg-white rounded-lg shadow-sm overflow-x-auto">
					<div class="px-5 py-3 bg-gray-50 border-b text-sm font-medium text-gray-700">
						{t("admin.tags.definedTags", {
							count: data.value.definitions.length,
						})}
					</div>
					{data.value.definitions.length === 0 ? (
						<div class="px-5 py-8 text-center text-gray-400 text-sm">
							{t("admin.tags.noTagsDefinedYetAdd")}
						</div>
					) : (
						<ul class="divide-y divide-gray-100">
							{data.value.definitions.map((def) => (
								<li
									key={def.id}
									class="px-5 py-3 flex items-start justify-between gap-3"
								>
									<div class="flex-1 min-w-0">
										<div class="flex items-center gap-2 flex-wrap">
											<span class="text-sm font-medium text-gray-900">
												{def.label}
											</span>
											<span
												class={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium capitalize ${CATEGORY_COLORS[def.category] ?? "bg-gray-100 text-gray-700"}`}
											>
												{def.category}
											</span>
										</div>
										<div class="text-xs text-gray-400 font-mono mt-0.5">
											{def.slug}
										</div>
										{def.description && (
											<div class="text-xs text-gray-500 mt-0.5">
												{def.description}
											</div>
										)}
									</div>
									<Form action={deleteAction} class="shrink-0">
										<input type="hidden" name="definitionId" value={def.id} />
										<button
											type="submit"
											preventdefault:click
											class="text-xs text-red-500 hover:text-red-700"
											onClick$={(e) => {
												if (
													!confirm(
														t("admin.tags.confirmDelete", { label: def.label }),
													)
												)
													return;
												(e.target as HTMLElement)
													.closest("form")
													?.requestSubmit();
											}}
										>
											{t("admin.tags.delete")}
										</button>
									</Form>
								</li>
							))}
						</ul>
					)}
				</div>

				{/* Add new definition */}
				<div class="bg-white rounded-lg shadow-sm p-5">
					<h3 class="text-base font-medium text-gray-900 mb-4">
						{t("admin.tags.addNewTag")}
					</h3>
					<Form action={createAction} class="space-y-4">
						<div>
							<label
								for="tag-label"
								class="block text-sm font-medium text-gray-700 mb-1"
							>
								{t("admin.tags.label")}
							</label>
							<input
								type="text"
								id="tag-label"
								name="label"
								required
								placeholder={t("admin.tags.eGBoardMember2026")}
								class="w-full border rounded-md px-3 py-2 text-sm"
							/>
						</div>
						<div>
							<label
								for="tag-slug"
								class="block text-sm font-medium text-gray-700 mb-1"
							>
								{t("admin.tags.slug")}
								<span class="ml-1 text-gray-400 font-normal">
									{t("admin.tags.lowercaseHyphensOnly")}
								</span>
							</label>
							<input
								type="text"
								id="tag-slug"
								name="slug"
								required
								placeholder={t("admin.tags.eGBoardMember20262")}
								class="w-full border rounded-md px-3 py-2 text-sm font-mono"
							/>
						</div>
						<div>
							<label
								for="tag-category"
								class="block text-sm font-medium text-gray-700 mb-1"
							>
								{t("admin.tags.category")}
							</label>
							<select
								id="tag-category"
								name="category"
								class="w-full border rounded-md px-3 py-2 text-sm"
							>
								<option value="board">{t("admin.tags.board")}</option>
								<option value="custom">{t("admin.tags.custom")}</option>
								<option value="participation">
									{t("admin.tags.participation")}
								</option>
								<option value="qualification">
									{t("admin.tags.qualification")}
								</option>
							</select>
						</div>
						<div>
							<label
								for="tag-description"
								class="block text-sm font-medium text-gray-700 mb-1"
							>
								{t("admin.tags.descriptionOptional")}
							</label>
							<input
								type="text"
								id="tag-description"
								name="description"
								placeholder={t("admin.tags.shownOnMemberProfile")}
								class="w-full border rounded-md px-3 py-2 text-sm"
							/>
						</div>
						<button
							type="submit"
							class="w-full bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700"
						>
							{t("admin.tags.addTag")}
						</button>
					</Form>
				</div>
			</div>
		</div>
	);
});
