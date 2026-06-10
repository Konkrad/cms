import { component$ } from "@qwik.dev/core";
import { Link, type DocumentHead, routeLoader$ } from "@qwik.dev/router";
import { postsService } from "~/services/posts.service";
import { formatUser } from "~/utils/users";
import { publicImageUrlFromKey, deriveThumbnailKey } from "~/utils/images";

export const usePost = routeLoader$(async ({ params, status }) => {
  const { id } = params;

  if (!id) {
    status(404);
    return null;
  }

  const post = await postsService.getById(id);

  if (!post) {
    status(404);
    return null;
  }

  // Resolve image URLs server-side
  const featuredImageUrl = publicImageUrlFromKey(post.featuredImage);

  let authorAvatarUrl: string | null = null;
  if (post.user?.profilePicture) {
    const thumbKey = (post.user as any).profilePictureSmall ?? deriveThumbnailKey(post.user.profilePicture);
    authorAvatarUrl = publicImageUrlFromKey(thumbKey);
  }

  // Fetch related posts (recent, excluding this one)
  const recentPosts = await postsService.getRecent(4);
  const relatedPosts = recentPosts
    .filter((p) => p.id !== id)
    .slice(0, 3)
    .map((p) => ({
      id: p.id,
      title: p.title,
      featuredImageUrl: publicImageUrlFromKey(p.featuredImage),
      createdAt: p.createdAt,
    }));

  return {
    ...post,
    featuredImageUrl,
    authorAvatarUrl,
    relatedPosts,
    user: formatUser(post.user, true),
  };
});

export default component$(() => {
  const post = usePost();

  if (!post.value) {
    return (
      <div class="max-w-4xl mx-auto px-4 py-16 text-center">
        <h1 class="text-4xl font-bold text-gray-900 mb-4">Post Not Found</h1>
        <p class="text-gray-600 mb-8">
          The post you're looking for doesn't exist or has been removed.
        </p>
        <Link href="/" class="text-blue-600 hover:text-blue-800 font-medium">
          Go back home
        </Link>
      </div>
    );
  }

  const p = post.value;

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
          <h1 class="text-3xl sm:text-4xl font-bold text-gray-900 leading-tight mb-3">
            {p.title}
          </h1>
          <time
            dateTime={p.createdAt}
            class="block text-sm text-gray-500 mb-8"
          >
            {formattedDate}
          </time>

          {/* Mobile: featured image sits between date and body */}
          {p.featuredImageUrl && (
            <div class="lg:hidden mb-8">
              <div class="rounded-2xl overflow-hidden mx-auto" style={{ aspectRatio: "1/1", width: "min(100%, 280px)" }}>
                <img
                  src={p.featuredImageUrl}
                  alt={p.title}
                  class="w-full h-full object-cover"
                />
              </div>
            </div>
          )}

          <div
            class="prose prose-lg max-w-none text-gray-800"
            dangerouslySetInnerHTML={p.body}
          />

          {/* Mobile: author block below body */}
          {p.showAuthor && (
            <div class="lg:hidden mt-10 pt-8 border-t border-gray-100">
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
        <section class="mt-20 pt-12 border-t border-gray-100">
          <h2 class="text-2xl font-bold text-gray-900 mb-8 text-center">
            Related Articles
          </h2>
          <div class="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {p.relatedPosts.map((related) => (
              <Link
                key={related.id}
                href={`/posts/${related.id}`}
                class="group block rounded-2xl overflow-hidden border border-gray-100 shadow-sm hover:shadow-md transition-shadow"
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
                  <div class="bg-blue-600" style={{ aspectRatio: "1/1" }} />
                )}
                <div class="p-4">
                  <time class="text-xs text-gray-400 block mb-1">
                    {new Date(related.createdAt).toLocaleDateString("en-GB", {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}
                  </time>
                  <h3 class="font-semibold text-gray-900 group-hover:text-blue-600 transition-colors line-clamp-2">
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
  <div class="bg-blue-900 rounded-2xl p-5 text-white">
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

export const head: DocumentHead = ({ resolveValue }) => {
  const post = resolveValue(usePost);

  if (!post) {
    return { title: "Post Not Found" };
  }

  return {
    title: post.title,
    meta: [
      {
        name: "description",
        content: post.body.slice(0, 160),
      },
    ],
  };
};
