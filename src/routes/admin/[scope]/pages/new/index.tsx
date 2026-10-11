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
import { itemRef, refHref } from "~/core/refs/refs";
import { allModules } from "~/core/registry/manifests";
import { adminUrl, scopeUrl } from "~/core/router/scope-path";
import { ADMIN_ACCESS, requireScopeRole } from "~/core/scopes/access";

/** Pages belong to the URL's scope; its managers create them. */
export const usePageScope = routeLoader$(async (event) => {
	const { scope } = await requireScopeRole(event, ADMIN_ACCESS);
	return {
		isRoot: scope.parentId === null,
		scopeUrl: scopeUrl(scope.path),
	};
});

export const useCreatePage = routeAction$(
	async (data, event) => {
		const { scope } = await requireScopeRole(event, ADMIN_ACCESS);
		const isRoot = scope.parentId === null;
		const slug = slugFromPath(data.url);

		try {
			const page = await pagesService.create(
				{
					scopeId: scope.id,
					slug,
					title: data.title,
					status: data.status,
				},
				allModules,
			);

			if (isRoot) {
				const menuName = data.menuName;
				const existing = await menuItemsService.getAll(menuName, {
					includeHidden: true,
				});
				const maxPosition = existing.reduce(
					(max, item) => Math.max(max, item.position),
					-1,
				);
				// The menu links to the page by reference: renaming it or moving it changes nothing.
				await menuItemsService.create({
					menuName,
					title: data.title,
					url: refHref(itemRef("core", "page", page.id)),
					pageId: page.id,
					parentId: null,
					position: maxPosition + 1,
					status: "hidden",
					icon: null,
					target: "_self",
				});
			}

			throw event.redirect(
				303,
				adminUrl(scope.path, `/pages/${page.id}/builder`),
			);
		} catch (err: any) {
			if (err?.status === 303) throw err;
			if (err instanceof PageError)
				return { success: false, error: err.message };
			throw err;
		}
	},
	zod$({
		title: z.string().min(1, "Title is required"),
		url: z.string().min(1, "URL is required"),
		menuName: z.enum(["main", "footer"]).default("main"),
		status: z.enum(["draft", "published"]).default("draft"),
	}),
);

export default component$(() => {
	const action = useCreatePage();
	const scope = usePageScope();

	return (
		<div class="max-w-2xl mx-auto px-4 py-8">
			<h1 class="text-3xl font-bold text-gray-900 mb-8">Create New Page</h1>

			{action.value?.error && (
				<div class="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded-sm">
					{action.value.error}
				</div>
			)}

			<Card>
				<Form action={action} class="space-y-6">
					<Input
						name="title"
						label="Page Title"
						required
						value={action.formData?.get("title")}
						error={action.value?.fieldErrors?.title?.[0]}
						placeholder="About Us"
					/>

					<div>
						<Input
							name="url"
							label="URL"
							required
							value={action.formData?.get("url")}
							error={action.value?.fieldErrors?.url?.[0]}
							placeholder="/about-us"
						/>
						<p class="mt-1 text-sm text-gray-500">
							One URL segment, served under this group's path:{" "}
							{scope.value.scopeUrl.replace(/\/$/, "")}/about-us
						</p>
					</div>

					{scope.value.isRoot && (
						<Select
							name="menuName"
							label="Menu"
							value={(action.formData?.get("menuName") as string) || "main"}
							error={action.value?.fieldErrors?.menuName?.[0]}
						>
							<option value="main">Main</option>
							<option value="footer">Footer</option>
						</Select>
					)}

					<Select
						name="status"
						label="Status"
						required
						value={(action.formData?.get("status") as string) || "draft"}
						error={action.value?.fieldErrors?.status?.[0]}
					>
						<option value="draft">Draft</option>
						<option value="published">Published</option>
					</Select>

					<div class="flex gap-4">
						<Button type="submit" disabled={action.isRunning}>
							{action.isRunning ? "Creating..." : "Create Page"}
						</Button>
						<Button
							type="button"
							variant="secondary"
							onClick$={() => window.history.back()}
						>
							Cancel
						</Button>
					</div>
				</Form>
			</Card>
		</div>
	);
});
