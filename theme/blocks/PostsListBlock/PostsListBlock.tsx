import { component$ } from "@qwik.dev/core";
import { usePostsList } from "~/components/builder/blocks/usePostsList";
import { CursorPager } from "~/components/ui/CursorPager";
import type { BlockDefinition } from "~/contracts/blocks";
import { ContentCard } from "~theme/shared/ContentCard/ContentCard";

interface PostsListBlockProps {
	limit?: number;
}

export const definition: BlockDefinition = {
	name: "Posts List",
	componentType: "PostsListBlock",
	category: "dynamic",
	icon: "📰",
	configSchema: [
		{
			name: "limit",
			label: "Posts per page",
			type: "number",
			defaultValue: 10,
		},
	],
	defaultData: {
		limit: 10,
	},
};

export default component$<PostsListBlockProps>((props) => {
	const { items, nextCursor, prevCursor, isLoading, error, goNext, goPrev } =
		usePostsList(props.limit ?? 10);

	return (
		<div class="max-w-6xl mx-auto px-4 py-12">
			{isLoading.value && items.value.length === 0 ? (
				<div class="text-center py-12">
					<p class="text-text-muted">Loading posts...</p>
				</div>
			) : error.value ? (
				<p class="text-error text-center py-8">
					Failed to load posts: {error.value}
				</p>
			) : items.value.length === 0 ? (
				<p class="text-text-muted text-center py-8">No posts found.</p>
			) : (
				<>
					<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
						{items.value.map((post) => (
							<ContentCard
								key={post.id}
								title={post.title}
								image={post.featuredImage ?? undefined}
								date={new Intl.DateTimeFormat("en-US", {
									day: "numeric",
									month: "long",
									year: "numeric",
								}).format(new Date(post.createdAt))}
								description={post.body
									.replace(/<[^>]+>/g, "")
									.substring(0, 160)}
								href={`/posts/${post.id}`}
								label="Read More"
							/>
						))}
					</div>

					<CursorPager
						hasPrevious={prevCursor.value !== null}
						hasNext={nextCursor.value !== null}
						isLoading={isLoading.value}
						onPrevious$={goPrev}
						onNext$={goNext}
					/>
				</>
			)}
		</div>
	);
});
