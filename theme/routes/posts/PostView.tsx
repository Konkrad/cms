import { component$ } from "@qwik.dev/core";
import { Link } from "@qwik.dev/router";
import type { PostViewData } from "~/contracts/posts";
import { PostCardList } from "~theme/shared/PostCard/PostCard";

/**
 * Themed presentation for a single post (`<scope path>/posts/:id`): the note layout for an
 * untitled post, the article layout for a titled one (`post.kind`).
 *
 * Pure view: receives secret-stripped, URL-resolved data from the route loader
 * via the `PostViewData` contract. `post.body` is already sanitized server-side
 * (`sanitizeRichHtml` in postsService) — sanitization stays in core, not here.
 */
export const PostView = component$<{ post: PostViewData | null }>(
	({ post }) => {
		if (!post) {
			return (
				<div class="max-w-4xl mx-auto px-4 py-16 text-center">
					<h1 class="text-4xl font-bold text-text-heading mb-4">
						Post Not Found
					</h1>
					<p class="text-text-secondary mb-8">
						The post you're looking for doesn't exist or has been removed.
					</p>
					<Link href="/" class="text-primary hover:text-primary font-medium">
						Go back home
					</Link>
				</div>
			);
		}

		const p = post;
		const formattedDate = new Date(p.publishedAt).toLocaleDateString("en-GB", {
			year: "numeric",
			month: "long",
			day: "numeric",
		});

		const subject = p.subject && (
			<p class="text-sm text-text-secondary mb-6">
				About{" "}
				<Link href={p.subject.url} class="text-primary hover:underline">
					{p.subject.title}
				</Link>
			</p>
		);

		const related = p.relatedPosts.length > 0 && (
			<section class="mt-20 pt-12 border-t border-border">
				<h2 class="text-2xl font-bold text-text-heading mb-8 text-center">
					More posts
				</h2>
				<PostCardList posts={p.relatedPosts} />
			</section>
		);

		// A note (no title): the text is the post, shown like a status update with its author.
		if (p.kind === "note") {
			return (
				<div class="max-w-2xl mx-auto px-4 sm:px-6 py-10">
					<article
						class="bg-bg-card border border-border p-6"
						data-post-layout="note"
					>
						<header class="flex items-center gap-3 mb-4">
							<Avatar
								displayName={p.author.displayName}
								avatarUrl={p.author.avatarUrl}
							/>
							<div>
								<Link
									href={p.author.profileUrl}
									class="font-semibold text-text-heading hover:text-primary"
								>
									{p.author.displayName}
								</Link>
								<time
									dateTime={p.publishedAt}
									class="block text-sm text-text-muted"
								>
									{formattedDate}
								</time>
							</div>
						</header>
						{subject}
						<div
							class="prose prose-lg max-w-none text-text"
							dangerouslySetInnerHTML={p.body}
						/>
					</article>
					{related}
				</div>
			);
		}

		// An article (titled): title, date, body, with the author beside it.
		return (
			<div class="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
				<article
					class="lg:grid lg:grid-cols-[1fr_320px] lg:gap-12"
					data-post-layout="article"
				>
					<div class="min-w-0">
						<h1 class="text-3xl sm:text-4xl font-bold text-text-heading leading-tight mb-3">
							{p.title}
						</h1>
						<time
							dateTime={p.publishedAt}
							class="block text-sm text-text-muted mb-8"
						>
							{formattedDate}
						</time>
						{subject}
						<div
							class="prose prose-lg max-w-none text-text"
							dangerouslySetInnerHTML={p.body}
						/>
					</div>
					<aside class="mt-10 lg:mt-1">
						<AuthorCard
							displayName={p.author.displayName}
							avatarUrl={p.author.avatarUrl}
							profileUrl={p.author.profileUrl}
						/>
					</aside>
				</article>
				{related}
			</div>
		);
	},
);

const Avatar = component$<{ displayName: string; avatarUrl: string | null }>(
	(props) =>
		props.avatarUrl ? (
			<img
				src={props.avatarUrl}
				alt=""
				width={44}
				height={44}
				class="w-11 h-11 object-cover rounded-full"
			/>
		) : (
			<span class="w-11 h-11 rounded-full bg-primary-dark flex items-center justify-center text-white font-semibold text-lg">
				{props.displayName.charAt(0).toUpperCase()}
			</span>
		),
);

// ── Author card sub-component ──
const AuthorCard = component$<{
	displayName: string;
	avatarUrl: string | null;
	profileUrl: string;
}>((props) => (
	<div class="bg-primary-dark p-5 text-white">
		<h3 class="text-lg font-bold mb-3">Author</h3>
		<div class="flex items-center gap-3 mb-4">
			{props.avatarUrl ? (
				<img
					src={props.avatarUrl}
					alt=""
					width={44}
					height={44}
					class="w-11 h-11 object-cover border-2 border-white/20"
				/>
			) : (
				<span class="w-11 h-11 bg-white/20 flex items-center justify-center text-white font-semibold text-lg">
					{props.displayName.charAt(0).toUpperCase()}
				</span>
			)}
			<span class="font-medium">{props.displayName}</span>
		</div>
		<Link
			href={props.profileUrl}
			class="inline-flex items-center gap-1.5 text-sm font-medium text-white/80 hover:text-white transition-colors"
		>
			Visit Profile →
		</Link>
	</div>
));
