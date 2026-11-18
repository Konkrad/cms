import { component$ } from "@qwik.dev/core";
import { Form, routeAction$, routeLoader$, z, zod$ } from "@qwik.dev/router";
import { Button } from "~/components/ui/Button";
import { Card } from "~/components/ui/Card";
import { Input } from "~/components/ui/Input";
import { Select } from "~/components/ui/Select";
import { menuItemsService } from "~/core/content/menu-items.service";
import {
	PageError,
	pagesService,
	slugFromPath,
} from "~/core/content/pages.service";
import { t } from "~/core/i18n";
import { allModules } from "~/core/registry/manifests";
import { adminUrl } from "~/core/router/scope-path";
import {
	ADMIN_ACCESS,
	requireScopeRole,
	requireWithinScope,
} from "~/core/scopes/access";

/** The page must belong to the URL's scope or one below it (managers of the scope). */
export const usePage = routeLoader$(async (event) => {
	const { scope } = await requireScopeRole(event, ADMIN_ACCESS);
	const page = await pagesService.getById(event.params.id);
	await requireWithinScope(event, scope, page);
	return {
		...page!,
		adminBase: adminUrl(scope.path),
		isRootPage: page!.scopeId === scope.id && scope.parentId === null,
	};
});

export const useUpdatePage = routeAction$(
	async (data, event) => {
		const { scope } = await requireScopeRole(event, ADMIN_ACCESS);
		const page = await pagesService.getById(event.params.id);
		await requireWithinScope(event, scope, page);
		const slug = slugFromPath(data.url);

		try {
			await pagesService.update(
				page!.id,
				{ title: data.title, slug, status: data.pageStatus },
				allModules,
			);
		} catch (err) {
			if (err instanceof PageError)
				return { success: false, error: err.message };
			throw err;
		}

		// Root pages: keep the linked menu item's title and visibility in step (it links to the
		// page by reference, so a new slug needs no change).
		if (page!.menuItem) {
			await menuItemsService.update(page!.menuItem.id, {
				title: data.title,
				status: data.visibility,
			});
		}

		throw event.redirect(303, adminUrl(scope.path, "/pages"));
	},
	zod$({
		title: z.string().min(1, t("admin.pages.titleRequired")),
		url: z.string().min(1, "URL is required"),
		pageStatus: z.enum(["draft", "published"]).default("draft"),
		visibility: z.enum(["visible", "hidden"]).default("hidden"),
	}),
);

export default component$(() => {
	const page = usePage();
	const action = useUpdatePage();

	const pageStatus =
		(action.formData?.get("pageStatus") as string) ||
		page.value.status ||
		"draft";
	const visibility =
		(action.formData?.get("visibility") as string) ||
		page.value.menuItem?.status ||
		"hidden";

	return (
		<div class="max-w-2xl mx-auto px-4 py-8">
			<h1 class="text-3xl font-bold text-gray-900 mb-8">
				{t("admin.pages.edit.editPageInfo")}
			</h1>

			{action.value?.error && (
				<div class="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded-sm">
					{action.value.error}
				</div>
			)}

			<Card>
				<Form action={action} class="space-y-6">
					<Input
						name="title"
						label={t("admin.pages.edit.pageTitle")}
						required
						value={action.formData?.get("title") || page.value.title}
						error={action.value?.fieldErrors?.title?.[0]}
					/>

					<div>
						<Input
							name="url"
							label={t("admin.pages.edit.url")}
							required
							value={action.formData?.get("url") || `/${page.value.slug}`}
							error={action.value?.fieldErrors?.url?.[0]}
						/>
						<p class="mt-1 text-sm text-gray-500">
							{t("admin.pages.edit.oneUrlSegmentServedUnder")}
						</p>
					</div>

					<Select
						name="pageStatus"
						label={t("admin.pages.edit.pageStatus")}
						required
						error={action.value?.fieldErrors?.pageStatus?.[0]}
					>
						<option value="draft" selected={pageStatus === "draft"}>
							{t("admin.pages.edit.draftPageIsNotPublicly")}
						</option>
						<option value="published" selected={pageStatus === "published"}>
							{t("admin.pages.edit.publishedPageIsPubliclyAccessible")}
						</option>
					</Select>

					{page.value.menuItem && (
						<Select
							name="visibility"
							label={t("admin.pages.edit.menuVisibility")}
							required
							error={action.value?.fieldErrors?.visibility?.[0]}
						>
							<option value="visible" selected={visibility === "visible"}>
								{t("admin.pages.edit.visibleShownInNavigation")}
							</option>
							<option value="hidden" selected={visibility === "hidden"}>
								{t("admin.pages.edit.hiddenNotShownInNavigation")}
							</option>
						</Select>
					)}

					<div class="flex gap-4">
						<Button type="submit" disabled={action.isRunning}>
							{action.isRunning
								? t("admin.pages.edit.updating")
								: t("admin.pages.edit.updatePage")}
						</Button>
						<Button href={`${page.value.adminBase}/pages`} variant="secondary">
							{t("admin.pages.edit.cancel")}
						</Button>
					</div>
				</Form>
			</Card>
		</div>
	);
});
