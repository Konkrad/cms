import { component$ } from "@qwik.dev/core";
import { Link } from "@qwik.dev/router";
import type { PostViewData } from "~/contracts/posts";

/**
 * Themed presentation for a single post (`/posts/[id]`).
 *
 * Pure view: receives secret-stripped, URL-resolved data from the route loader
 * via the `PostViewData` contract. `post.body` is already sanitized server-side
 * (`sanitizeRichHtml` in postsService) — sanitization stays in core, not here.
 */
export const PostView = component$<{ post: PostViewData | null }>(({ post }) => {
  if (!post) {
    return (
      <div class="max-w-4xl mx-auto px-4 py-16 text-center">
        <h1 class="text-4xl font-bold text-text-heading mb-4">Post Not Found</h1>
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

  const formattedDate = new Date(p.createdAt).toLocaleDateString("en-GB", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div class="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      {/* ── Main article grid ── */}
      <div class="lg:grid lg:grid-cols-[1fr_320px] lg:gap-12">
        {/* Left: title + date + body */}
        <div class="min-w-0">
          <h1 class="text-3xl sm:text-4xl font-bold text-text-heading leading-tight mb-3">
            {p.title}
          </h1>
          <time dateTime={p.createdAt} class="block text-sm text-text-muted mb-8">
            {formattedDate}
          </time>

          {/* Mobile: featured image sits between date and body */}
          {p.featuredImageUrl && (
            <div class="lg:hidden mb-8">
              <div
                class="rounded-2xl overflow-hidden mx-auto"
                style={{ aspectRatio: "1/1", width: "min(100%, 280px)" }}
              >
                <img
                  src={p.featuredImageUrl}
                  alt={p.title}
                  class="w-full h-full object-cover"
                />
              </div>
            </div>
          )}

          <div
            class="prose prose-lg max-w-none text-text"
            dangerouslySetInnerHTML={p.body}
          />

          {/* Mobile: author block below body */}
          {p.showAuthor && (
            <div class="lg:hidden mt-10 pt-8 border-t border-border">
              <AuthorCard
                displayName={p.user.displayName}
                avatarUrl={p.authorAvatarUrl}
                userId={p.userId}
              />
            </div>
          )}
        </div>

        {/* Right sidebar: image + author (desktop only) */}
        <aside class="hidden lg:flex flex-col gap-6 mt-1">
          {p.featuredImageUrl && (
            <div class="rounded-2xl overflow-hidden shadow-sm">
              <img
                src={p.featuredImageUrl}
                alt={p.title}
                class="w-full object-cover"
                style={{ aspectRatio: "1/1" }}
              />
            </div>
          )}

          {p.showAuthor && (
            <AuthorCard
              displayName={p.user.displayName}
              avatarUrl={p.authorAvatarUrl}
              userId={p.userId}
            />
          )}
        </aside>
      </div>

      {/* ── Related articles ── */}
      {p.relatedPosts.length > 0 && (
        <section class="mt-20 pt-12 border-t border-border">
          <h2 class="text-2xl font-bold text-text-heading mb-8 text-center">
            Related Articles
          </h2>
          <div class="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {p.relatedPosts.map((related) => (
              <Link
                key={related.id}
                href={`/posts/${related.id}`}
                class="group block rounded-2xl overflow-hidden border border-border shadow-sm hover:shadow-md transition-shadow"
              >
                {related.featuredImageUrl ? (
                  <div class="overflow-hidden" style={{ aspectRatio: "1/1" }}>
                    <img
                      src={related.featuredImageUrl}
                      alt={related.title}
                      class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  </div>
                ) : (
                  <div class="bg-primary" style={{ aspectRatio: "1/1" }} />
                )}
                <div class="p-4">
                  <time class="text-xs text-text-muted block mb-1">
                    {new Date(related.createdAt).toLocaleDateString("en-GB", {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}
                  </time>
                  <h3 class="font-semibold text-text-heading group-hover:text-primary transition-colors line-clamp-2">
                    {related.title}
                  </h3>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
});

// ── Author card sub-component ──
const AuthorCard = component$<{
  displayName: string;
  avatarUrl: string | null;
  userId: string;
}>((props) => (
  <div class="bg-primary-dark rounded-2xl p-5 text-white">
    <h3 class="text-lg font-bold mb-3">Author</h3>
    <div class="flex items-center gap-3 mb-4">
      {props.avatarUrl ? (
        <img
          src={props.avatarUrl}
          alt=""
          width={44}
          height={44}
          class="w-11 h-11 rounded-full object-cover border-2 border-white/20"
        />
      ) : (
        <span class="w-11 h-11 rounded-full bg-white/20 flex items-center justify-center text-white font-semibold text-lg">
          {props.displayName.charAt(0).toUpperCase()}
        </span>
      )}
      <span class="font-medium">{props.displayName}</span>
    </div>
    <Link
      href={`/profile/${props.userId}`}
      class="inline-flex items-center gap-1.5 text-sm font-medium text-white/80 hover:text-white transition-colors"
    >
      Visit Profile →
    </Link>
  </div>
));
