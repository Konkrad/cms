import { component$ } from "@qwik.dev/core";
import { routeAction$, routeLoader$, zod$ } from "@qwik.dev/router";
import { Button } from "~/components/ui/Button";
import { ArticleForm } from "~/core/admin/ContentForms/ArticleForm";
import type { ContentFormResult } from "~/core/admin/ContentForms/form-result";
import { articlesService } from "~/core/content/articles.service";
import {
	articleFormSchema,
	subjectFromField,
} from "~/core/content/content-form";
import { ContentInputError } from "~/core/content/content-items";
import { adminUrl } from "~/core/router/scope-path";
import {
	ADMIN_ACCESS,
	allowedVisibilities,
	requireScopeRole,
} from "~/core/scopes/access";

export const useArticleContext = routeLoader$(async (event) => {
	const { user, scope } = await requireScopeRole(event, ADMIN_ACCESS);
	return {
		base: adminUrl(scope.path),
		visibilities: await allowedVisibilities(user, scope.id),
	};
});

export const useCreateArticle = routeAction$(
	async (data, event): Promise<ContentFormResult> => {
		const { user, scope } = await requireScopeRole(event, ADMIN_ACCESS);
		try {
			// The scope comes from the admin URL; visibility, subject and image key are checked
			// by the service.
			await articlesService.create({
				scopeId: scope.id,
				title: data.title,
				featuredImage: data.featuredImage || null,
				body: data.body,
				visibility: data.visibility,
				...subjectFromField(data.subject),
				authorId: user.id,
			});
		} catch (error) {
			if (error instanceof ContentInputError)
				return { success: false, error: error.message };
			throw error;
		}
		throw event.redirect(303, adminUrl(scope.path, "/articles"));
	},
	zod$(articleFormSchema),
);

export default component$(() => {
	const ctx = useArticleContext();
	const createArticle = useCreateArticle();
	return (
		<div>
			<div class="flex items-center justify-between mb-6">
				<h2 class="text-2xl font-bold text-gray-800">New article</h2>
				<Button href={`${ctx.value.base}/articles`} variant="secondary">
					Back to Articles
				</Button>
			</div>
			<div class="bg-white rounded-lg shadow-sm p-6">
				<ArticleForm
					action={createArticle}
					visibilities={ctx.value.visibilities}
					subjectPicker
					submitLabel="Publish"
					cancelHref={`${ctx.value.base}/articles`}
				/>
			</div>
		</div>
	);
});
