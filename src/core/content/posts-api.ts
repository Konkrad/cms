import type { PostCardData } from "~/contracts/posts";
import { toPostCards } from "~/core/content/post-cards";
import { postExcerpt, postKind } from "~/core/content/posts";
import {
	type Post,
	type PostInput,
	postsService,
} from "~/core/content/posts.service";
import { itemUrl } from "~/core/registry/refs";

/**
 * The posts API for modules (`posts` from `~/core`; guide 5.3). Server-only. A module attaches
 * posts to its items with a subject (`subjectType` = `<module>:<type>`, e.g. `events:event`)
 * instead of keeping an updates table of its own, and shows them on the item's page.
 *
 * Authorization is the caller's: call these from loaders and actions that already ran
 * `requireModuleAdmin` / `requireScopeRole` (create, update, delete) or checked that the viewer
 * may see the item (`forSubject`). The service still validates what no caller can be trusted
 * with: the scope, the visibility (`allowedVisibilities` for the author), the subject reference,
 * and it sanitizes the body.
 */
export const posts = {
	/**
	 * The published posts about an item that `viewer` may see (each post's own visibility),
	 * newest first, as theme payloads with public authors.
	 */
	async forSubject(
		subjectType: string,
		subjectId: string,
		viewer: { id: string } | null,
	): Promise<PostCardData[]> {
		const rows = await postsService.forSubject(subjectType, subjectId, viewer);
		return toPostCards(rows, { loggedIn: !!viewer });
	},

	/**
	 * Every post about an item whatever its visibility, for the item's admin page (callers are
	 * managers of the item's scope). Author names only.
	 */
	async listForSubjectAdmin(subjectType: string, subjectId: string) {
		const rows = await postsService.listForSubject(subjectType, subjectId);
		return rows.map((p) => ({
			id: p.id,
			kind: postKind(p),
			title: p.title,
			excerpt: postExcerpt(p.body, 120),
			visibility: p.visibility,
			publishedAt: p.publishedAt,
			authorName: `${p.author.name} ${p.author.familyName}`,
		}));
	},

	/** Creates and publishes a post by `authorId`; throws `PostInputError` for bad input. */
	async create(
		input: PostInput & { authorId: string },
	): Promise<{ id: string; url: string }> {
		const post = await postsService.create(input);
		return { id: post.id, url: await itemUrl("core:post", post) };
	},

	/** Updates title, body, visibility or subject; `editorId` is checked like an author. */
	update: (
		id: string,
		input: Partial<Omit<PostInput, "scopeId">>,
		editorId: string,
	): Promise<Post | undefined> => postsService.update(id, input, editorId),

	/**
	 * Deletes a post. With `subject`, only when the post is about that item (an item's admin
	 * page deleting "its" posts by id); returns whether a post was deleted.
	 */
	async delete(
		id: string,
		subject?: { subjectType: string; subjectId: string },
	): Promise<boolean> {
		const post = await postsService.getById(id);
		if (!post) return false;
		if (
			subject &&
			(post.subjectType !== subject.subjectType ||
				post.subjectId !== subject.subjectId)
		)
			return false;
		await postsService.delete(id);
		return true;
	},
};

export { PostInputError } from "~/core/content/posts";
export type { PostInput };
