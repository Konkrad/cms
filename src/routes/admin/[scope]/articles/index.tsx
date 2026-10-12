import { component$ } from "@qwik.dev/core";
import {
	Form,
	Link,
	routeAction$,
	routeLoader$,
	z,
	zod$,
} from "@qwik.dev/router";
import { Button } from "~/components/ui/Button";
import { PAGE_SIZE, Pagination } from "~/core/admin/Pagination/Pagination";
import { SearchBar } from "~/core/admin/SearchBar/SearchBar";
import { articlesService } from "~/core/content/articles.service";
import { formatDate } from "~/core/i18n";
import { publicImageUrlFromKey } from "~/core/media/images";
import { ReviewStatusBadge } from "~/core/reviews/ReviewStatusBadge";
import { withReviewStatus } from "~/core/reviews/reviews";
import { adminUrl } from "~/core/router/scope-path";
import {
	ADMIN_ACCESS,
	isWithinScope,
	requireScopeRole,
} from "~/core/scopes/access";
import { scopesService } from "~/core/scopes/scopes.service";
import { assertNoPrivateFields } from "~/core/shared/no-private-fields";

export const useArticles = routeLoader$(async (event) => {
	const { scope } = await requireScopeRole(event, ADMIN_ACCESS);
	const { url } = event;
	const isRoot = scope.parentId === null;
	const search = url.searchParams.get("search")?.trim() ?? "";
	const page = Math.max(
		1,
		parseInt(url.searchParams.get("page") ?? "1", 10) || 1,
	);

	const { total, items } = await articlesService.adminList({
		// The root lists every article; other scopes their own and their subtree's.
		scopeIds: isRoot ? null : await scopesService.subtreeIds(scope.id),
		search,
		limit: PAGE_SIZE,
		offset: (page - 1) * PAGE_SIZE,
	});

	return assertNoPrivateFields({
		articles: (await withReviewStatus("article", items)).map(
			({ featuredImage, ...a }) => ({
				...a,
				imageUrl: publicImageUrlFromKey(featuredImage),
			}),
		),
		total,
		page,
		pageSize: PAGE_SIZE,
		search,
		isRoot,
		base: adminUrl(scope.path),
	});
});

export const useDeleteArticle = routeAction$(
	async (data, event) => {
		const { scope } = await requireScopeRole(event, ADMIN_ACCESS);
		const target = await articlesService.getById(data.articleId);
		if (!target) throw event.error(404, "Article not found");
		if (!(await isWithinScope(scope, target.scopeId)))
			throw event.error(403, "Forbidden");
		await articlesService.delete(target.id);
		return { success: true };
	},
	zod$({ articleId: z.string().min(1) }),
);

export default component$(() => {
	const data = useArticles();
	const deleteArticle = useDeleteArticle();
	const totalPages = Math.ceil(data.value.total / data.value.pageSize);

	return (
		<div>
			<div class="flex items-center justify-between mb-6">
				<h2 class="text-2xl font-bold text-gray-800">
					{data.value.isRoot ? "All Articles" : "Group Articles"}
				</h2>
				<Button href={`${data.value.base}/articles/new`}>New article</Button>
			</div>

			<SearchBar value={data.value.search} placeholder="Search articles…" />

			<div class="bg-white rounded-lg shadow-sm overflow-x-auto">
				<table class="min-w-full divide-y divide-gray-200">
					<thead class="bg-gray-50">
						<tr>
							<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
								Article
							</th>
							<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
								Author
							</th>
							<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
								Published
							</th>
							<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
								Actions
							</th>
						</tr>
					</thead>
					<tbody class="bg-white divide-y divide-gray-200">
						{data.value.articles.map((article) => (
							<tr key={article.id} class="hover:bg-gray-50">
								<td class="px-6 py-4">
									<div class="flex items-center gap-3">
										{article.imageUrl && (
											<img
												src={article.imageUrl}
												alt=""
												width={40}
												height={40}
												class="w-10 h-10 object-cover rounded-sm shrink-0"
											/>
										)}
										<div class="min-w-0">
											<div class="text-sm font-medium text-gray-900">
												{article.title}
											</div>
											<div class="text-sm text-gray-500 line-clamp-1">
												{article.excerpt}
											</div>
										</div>
									</div>
								</td>
								<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
									{article.author.name} {article.author.familyName}
								</td>
								<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
									{article.publishedAt ? (
										formatDate(article.publishedAt)
									) : (
										<ReviewStatusBadge review={article.review} />
									)}
								</td>
								<td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
									<div class="flex items-center gap-4">
										<Link
											href={`${data.value.base}/articles/${article.id}/edit`}
											class="text-blue-600 hover:text-blue-900"
										>
											Edit
										</Link>
										<Form action={deleteArticle}>
											<input
												type="hidden"
												name="articleId"
												value={article.id}
											/>
											<button
												type="submit"
												preventdefault:click
												class="text-red-600 hover:text-red-900"
												onClick$={(e) => {
													if (!confirm("Delete this article?")) return;
													(e.target as HTMLElement)
														.closest("form")
														?.requestSubmit();
												}}
											>
												Delete
											</button>
										</Form>
									</div>
								</td>
							</tr>
						))}
					</tbody>
				</table>
				{data.value.articles.length === 0 && (
					<div class="text-center py-12 text-gray-500">
						{data.value.search
							? `No articles matching "${data.value.search}".`
							: "No articles yet. Write the first one!"}
					</div>
				)}
				<Pagination
					page={data.value.page}
					totalPages={totalPages}
					total={data.value.total}
					pageSize={data.value.pageSize}
				/>
			</div>
		</div>
	);
});
