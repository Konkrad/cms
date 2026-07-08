import { component$ } from "@qwik.dev/core";
import { type DocumentHead, routeLoader$ } from "@qwik.dev/router";
import { postsService } from "~/services/posts.service";
import { formatUser } from "~/utils/users";
import { publicImageUrlFromKey, deriveThumbnailKey } from "~/utils/images";
import { useThemeComponent$ } from "~/utils/theme-loader";
import { ThemeComponent } from "~/utils/theme-components";

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
    const thumbKey =
      (post.user as any).profilePictureSmall ??
      deriveThumbnailKey(post.user.profilePicture);
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

  // `formatUser(..., true)` strips PII before serialization; the theme only ever
  // sees what this loader returns (see ~/contracts/posts → PostViewData).
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
  const PostView = useThemeComponent$(
    () => import("~theme/routes/posts/PostView"),
  );

  return <ThemeComponent resource={PostView} post={post.value} />;
});

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
