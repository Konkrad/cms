import { component$ } from "@qwik.dev/core";
import { Form, Link, routeAction$, routeLoader$ } from "@qwik.dev/router";
import { format } from "date-fns";
import { Button } from "~/components/ui/Button";
import { PAGE_SIZE, Pagination } from "~/core/admin/Pagination/Pagination";
import { SearchBar } from "~/core/admin/SearchBar/SearchBar";
import { postsService } from "~/core/content/posts.service";
import { adminUrl } from "~/core/router/scope-path";
import {
	ADMIN_ACCESS,
	isWithinScope,
	requireScopeRole,
} from "~/core/scopes/access";
import { scopesService } from "~/core/scopes/scopes.service";

export const usePosts = routeLoader$(async (event) => {
	const { scope } = await requireScopeRole(event, ADMIN_ACCESS);
	const { url } = event;
	const isRoot = scope.parentId === null;
	const search = url.searchParams.get("search")?.trim() ?? "";
	const page = Math.max(
		1,
		parseInt(url.searchParams.get("page") ?? "1", 10) || 1,
	);
	const offset = (page - 1) * PAGE_SIZE;

	const { total, items } = await postsService.adminList({
		// The root lists every post; other scopes their own and their subtree's.
		scopeIds: isRoot ? null : await scopesService.subtreeIds(scope.id),
		search,
		limit: PAGE_SIZE,
		offset,
	});

	return {
		posts: items,
		total,
		page,
		pageSize: PAGE_SIZE,
		search,
		isRoot,
		base: adminUrl(scope.path),
	};
});

export const useDeletePost = routeAction$(async (data, event) => {
	const { scope } = await requireScopeRole(event, ADMIN_ACCESS);
	const target = await postsService.getById(data.postId as string);
	if (!target) throw event.error(404, "Post not found");
	if (!(await isWithinScope(scope, target.scopeId)))
		throw event.error(403, "Forbidden");
	await postsService.delete(data.postId as string);
	return { success: true };
});

export default component$(() => {
	const data = usePosts();
	const deletePostAction = useDeletePost();
	const totalPages = Math.ceil(data.value.total / data.value.pageSize);

	return (
		<div>
			<div class="flex items-center justify-between mb-6">
				<h2 class="text-2xl font-bold text-gray-800">
					{data.value.isRoot ? "All Posts" : "Group Posts"}
				</h2>
				<Button href={`${data.value.base}/posts/new`}>Create New Post</Button>
			</div>

			<SearchBar value={data.value.search} placeholder="Search by title…" />

			<div class="bg-white rounded-lg shadow-sm overflow-x-auto">
				<table class="min-w-full divide-y divide-gray-200">
					<thead class="bg-gray-50">
						<tr>
							<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
								Title
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
						{data.value.posts.map((post) => (
							<tr key={post.id} class="hover:bg-gray-50">
								<td class="px-6 py-4">
									<div class="text-sm font-medium text-gray-900">
										{post.title}
									</div>
									<div class="text-sm text-gray-500 line-clamp-1">
										{post.body.substring(0, 100)}…
									</div>
								</td>
								<td class="px-6 py-4 whitespace-nowrap">
									<div class="text-sm text-gray-900">
										{post.user.name} {post.user.familyName}
									</div>
								</td>
								<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
									{format(new Date(post.createdAt), "MMM d, yyyy")}
								</td>
								<td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
									<div class="flex items-center gap-4">
										<Link
											href={`${data.value.base}/posts/${post.id}/edit`}
											class="text-blue-600 hover:text-blue-900"
										>
											Edit
										</Link>
										<Form action={deletePostAction}>
											<input type="hidden" name="postId" value={post.id} />
											<button
												type="submit"
												preventdefault:click
												class="text-red-600 hover:text-red-900"
												onClick$={(e) => {
													if (
														!confirm(
															"Are you sure you want to delete this post?",
														)
													)
														return;
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
				{data.value.posts.length === 0 && (
					<div class="text-center py-12 text-gray-500">
						{data.value.search
							? `No posts matching "${data.value.search}".`
							: "No posts found. Create your first post!"}
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
