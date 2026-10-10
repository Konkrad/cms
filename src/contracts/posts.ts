/**
 * Core → theme data contracts for the posts routes.
 *
 * Types here are DERIVED FROM THE ROUTE LOADERS, so any field the loader strips
 * (secrets/PII) is automatically absent from the contract. Theme components
 * import these types (`~/contracts/posts`) instead of deep-importing route files
 * or reaching into services. `import type` only — these carry no runtime code.
 */

import type { PostWithUser } from "~/core/content/posts.service";
import type { PublicUser } from "~/core/users/public-user";
import type { usePost } from "~/routes/posts/[id]";

/** Non-null data passed to the themed single-post view. */
export type PostViewData = NonNullable<ReturnType<typeof usePost>["value"]>;

/** Post shape returned by the posts-block composables — `featuredImage` resolved to a public URL, `user` formatted for display. */
export type BlockPost = Omit<PostWithUser, "featuredImage" | "user"> & {
	featuredImage: string | null;
	user: PublicUser & { displayName: string };
};

/** Post list page as returned by `~/core/content/builder/blocks/usePostsList`. */
export type PostsPage = {
	items: BlockPost[];
	nextCursor: string | null;
	prevCursor: string | null;
};

/** Hero post as returned by `~/core/content/builder/blocks/useHeroSection`. */
export type HeroPost = Omit<PostWithUser, "featuredImage"> & {
	featuredImageUrl: string | null;
};
