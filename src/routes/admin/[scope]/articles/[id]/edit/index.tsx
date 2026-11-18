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
import { subjectFieldValue } from "~/core/content/stream-cards";
import { t } from "~/core/i18n";
import { publicImageUrlFromKey } from "~/core/media/images";
import { adminUrl } from "~/core/router/scope-path";
import {
	ADMIN_ACCESS,
	allowedVisibilities,
	isWithinScope,
	requireScopeRole,
} from "~/core/scopes/access";
import { assertNoPrivateFields } from "~/core/shared/no-private-fields";

export const useArticle = routeLoader$(async (event) => {
	const { user, scope } = await requireScopeRole(event, ADMIN_ACCESS);
	const article = await articlesService.getById(event.params.id);
	if (!article) throw event.redirect(303, adminUrl(scope.path, "/articles"));
	if (!(await isWithinScope(scope, article.scopeId)))
		throw event.error(403, "Forbidden");
	// The current visibility stays selectable (unchanged values are not re-checked).
	const allowed = await allowedVisibilities(user, article.scopeId);
	const imageUrl = publicImageUrlFromKey(article.featuredImage);
	return assertNoPrivateFields({
		base: adminUrl(scope.path),
		visibilities: [...new Set([article.visibility, ...allowed])],
		article: {
			id: article.id,
			title: article.title,
			body: article.body,
			visibility: article.visibility,
			// A public image key (`public/articles/…`), shown through its public URL.
			image:
				article.featuredImage && imageUrl
					? { key: article.featuredImage, url: imageUrl }
					: null,
			subject: await subjectFieldValue(article),
		},
	});
});

export const useUpdateArticle = routeAction$(
	async (data, event): Promise<ContentFormResult> => {
		const { user, scope } = await requireScopeRole(event, ADMIN_ACCESS);
		const target = await articlesService.getById(event.params.id);
		if (!target) return { success: false, error: t("admin.articles.notFound") };
		if (!(await isWithinScope(scope, target.scopeId)))
			throw event.error(403, "Forbidden");
		try {
			const saved = await articlesService.update(
				target.id,
				{
					title: data.title,
					featuredImage: data.featuredImage || null,
					body: data.body,
					visibility: data.visibility,
					...subjectFromField(data.subject),
				},
				user.id,
			);
			return { success: true, inReview: !!saved && !saved.publishedAt };
		} catch (error) {
			if (error instanceof ContentInputError)
				return { success: false, error: error.message };
			throw error;
		}
	},
	zod$(articleFormSchema),
);

export default component$(() => {
	const data = useArticle();
	const updateArticle = useUpdateArticle();
	return (
		<div>
			<div class="flex items-center justify-between mb-6">
				<h2 class="text-2xl font-bold text-gray-800">
					{t("admin.articles.edit.editArticle")}
				</h2>
				<Button href={`${data.value.base}/articles`} variant="secondary">
					{t("admin.articles.edit.backToArticles")}
				</Button>
			</div>
			<div class="bg-white rounded-lg shadow-sm p-6">
				<ArticleForm
					action={updateArticle}
					visibilities={data.value.visibilities}
					values={data.value.article}
					subjectPicker
					submitLabel={t("admin.articles.edit.saveChanges")}
					cancelHref={`${data.value.base}/articles`}
					successMessage={t("admin.articles.edit.articleUpdated")}
				/>
			</div>
		</div>
	);
});
