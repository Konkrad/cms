/**
 * Core → theme data contracts for the posts routes.
 *
 * Payload types are DECLARED here (the loaders return exactly these types), so a
 * new field reaches the page only by adding it to the contract. Theme components
 * import these types (`~/contracts/posts`) instead of deep-importing route files
 * or reaching into services. `import type` only — these carry no runtime code.
 */

import type { PostWithUser } from "~/core/content/posts.service";
import type { Post } from "~/core/content/schema/posts";
import type { PublicUser } from "~/core/users/public-user";

/** Payload of `/posts/[id]` (declared, not derived: it shows the author). */
export type PostViewData = Post & {
	featuredImageUrl: string | null;
	/** The author's public thumbnail URL. */
	authorAvatarUrl: string | null;
	relatedPosts: Array<{
		id: string;
		title: string;
		featuredImageUrl: string | null;
		createdAt: string;
	}>;
	user: PublicUser & {
		profilePictureSmallUrl: string | null;
		displayName: string;
	};
};

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
