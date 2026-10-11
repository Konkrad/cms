import { component$ } from "@qwik.dev/core";
import type { PostCardData } from "~/contracts/posts";

const VISIBILITY_NOTE: Record<string, string | undefined> = {
	members: "Members only",
	representatives: "Representatives only",
};

function formatDate(date: string): string {
	return new Date(date).toLocaleDateString("en-GB", {
		year: "numeric",
		month: "long",
		day: "numeric",
	});
}

/**
 * One post in a listing, a feed or under the item it is about. The layout follows
 * `post.kind`: a note (untitled) is shown whole like a status update, with its author first;
 * an article (titled) is a card with its title and an excerpt that links to the article.
 * `post.body` is sanitized server-side (`sanitizeRichHtml` in the posts service).
 */
export const PostCard = component$<{ post: PostCardData }>(({ post }) => {
	const meta = [
		formatDate(post.publishedAt),
		post.source,
		VISIBILITY_NOTE[post.visibility],
	]
		.filter(Boolean)
		.join(" · ");

	if (post.kind === "note") {
		return (
			<article
				class="flex flex-col gap-3 bg-bg-card border border-border p-4"
				data-post-kind="note"
			>
				<header class="flex items-baseline justify-between gap-3">
					<a
						href={post.author.profileUrl}
						class="font-semibold text-text-heading hover:text-primary"
					>
						{post.author.displayName}
					</a>
					<a href={post.url} class="text-xs text-text-muted hover:text-primary">
						<time dateTime={post.publishedAt}>{meta}</time>
					</a>
				</header>
				<div
					class="prose max-w-none text-text"
					dangerouslySetInnerHTML={post.body ?? ""}
				/>
			</article>
		);
	}

	return (
		<a
			href={post.url}
			class="group flex flex-col bg-bg-card border border-border overflow-hidden hover:border-border-strong transition-colors"
			data-post-kind="article"
		>
			<div class="flex flex-col flex-1 p-4 gap-1">
				<h3 class="font-semibold text-text-heading group-hover:text-primary transition-colors leading-snug line-clamp-2">
					{post.title}
				</h3>
				<p class="text-xs text-text-muted">
					{post.author.displayName} · {meta}
				</p>
				{post.excerpt && (
					<p class="text-sm text-text-secondary mt-1 line-clamp-3">
						{post.excerpt}
					</p>
				)}
				<span class="text-sm font-medium text-primary mt-auto pt-3">
					Read more →
				</span>
			</div>
		</a>
	);
});

/** Posts of one listing, notes and articles mixed in one column-balanced grid. */
export const PostCardList = component$<{ posts: PostCardData[] }>(
	({ posts }) => (
		<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 items-start">
			{posts.map((post) => (
				<PostCard key={post.id} post={post} />
			))}
		</div>
	),
);
