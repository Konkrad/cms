/**
 * Core → theme data contract for the post archive routes
 * (`/archive/posts`, `/archive/posts/[page]`).
 */
import type { PostWithUser } from "~/core/content/posts.service";

export type ArchivePostItem = Omit<PostWithUser, "featuredImage"> & {
	featuredImage: string | null;
	/** Canonical URL under the owning scope. */
	url: string;
};

export type ArchivePostsViewData = {
	page: number;
	items: ArchivePostItem[];
	totalPages: number;
	previousHref: string | null;
	nextHref: string | null;
} | null;
