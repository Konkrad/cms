import {
	ContentInputError,
	NOTE_MAX_LENGTH,
	toPlainText,
} from "~/core/content/content-items";
import {
	sanitizeNoteHtml,
	sanitizeRichHtml,
} from "~/core/content/sanitize-html";
import { parseRef } from "~/core/refs/refs";
import { internalLinksToRefs, resolveRef } from "~/core/registry/refs";
import {
	allowedVisibilities,
	canViewScope,
	getScope,
} from "~/core/scopes/access";
import { VISIBILITIES, type Visibility } from "~/core/scopes/visibility";

/**
 * Server-only checks shared by the notes and articles services: what no caller can be trusted
 * with (scope, visibility for the author, subject reference) and sanitizing on write.
 */

/** What the item is about: `<module>:<type>` (`events:event`) plus the item id, both or neither. */
export interface SubjectInput {
	subjectType?: string | null;
	subjectId?: string | null;
}

/** What a caller may set on a note or an article besides its own fields. */
export interface StreamItemInput extends SubjectInput {
	/** Owning scope (site-wide = the root). */
	scopeId: string;
	/** HTML; core sanitizes it on write. */
	body: string;
	visibility: Visibility;
}

const SUBJECT_TYPE_RE = /^[a-z][a-z0-9-]{0,39}:[a-z][a-z0-9-]{0,39}$/;

/**
 * The subject columns for an input, or throws when the subject does not resolve: malformed,
 * an unknown or inactive module or type, or an item that is gone (`resolveRef` is null).
 */
export async function validateSubject(
	subjectType: string | null | undefined,
	subjectId: string | null | undefined,
): Promise<{ subjectType: string | null; subjectId: string | null }> {
	const type = subjectType?.trim() || null;
	const id = subjectId?.trim() || null;
	if (!type && !id) return { subjectType: null, subjectId: null };
	if (!type || !id)
		throw new ContentInputError("A subject needs both a type and an id");
	if (!SUBJECT_TYPE_RE.test(type) || !parseRef(`${type}:${id}`))
		throw new ContentInputError(`Invalid subject: ${type}:${id}`);
	if ((await resolveRef(`${type}:${id}`)) === null)
		throw new ContentInputError(
			`The subject ${type}:${id} does not exist or its module is not active`,
		);
	return { subjectType: type, subjectId: id };
}

/**
 * The subject columns for an update: an unchanged subject is kept even if it no longer
 * resolves (module deactivated); a changed one is validated. Undefined = no change.
 */
export async function changedSubject(
	input: SubjectInput,
	current: { subjectType: string | null; subjectId: string | null },
): Promise<{ subjectType: string | null; subjectId: string | null } | null> {
	if (input.subjectType === undefined && input.subjectId === undefined)
		return null;
	const type = input.subjectType?.trim() || null;
	const id = input.subjectId?.trim() || null;
	if (type === current.subjectType && id === current.subjectId) return null;
	return validateSubject(type, id);
}

export async function requireExistingScope(scopeId: string): Promise<void> {
	if (!(await getScope(scopeId))) throw new ContentInputError("Unknown scope");
}

/** Throws unless `authorId` may publish with `visibility` in the scope (`allowedVisibilities`). */
export async function checkVisibility(
	authorId: string,
	scopeId: string,
	visibility: Visibility,
): Promise<void> {
	if (!VISIBILITIES.includes(visibility))
		throw new ContentInputError(`Unknown visibility: ${visibility}`);
	if (
		!(await allowedVisibilities({ id: authorId }, scopeId)).includes(visibility)
	)
		throw new ContentInputError("You cannot publish with this visibility");
}

/** An article body for storage: full rich text, links to site pages as references. */
export async function cleanArticleBody(body: string): Promise<string> {
	// Rendered with dangerouslySetInnerHTML: links to site pages become references first.
	const clean = sanitizeRichHtml(await internalLinksToRefs(body));
	if (!toPlainText(clean)) throw new ContentInputError("The article is empty");
	return clean;
}

/** A note body for storage: links only, at most `NOTE_MAX_LENGTH` characters of text. */
export async function cleanNoteBody(body: string): Promise<string> {
	const clean = sanitizeNoteHtml(await internalLinksToRefs(body));
	const length = toPlainText(clean).length;
	if (!length) throw new ContentInputError("The note is empty");
	if (length > NOTE_MAX_LENGTH)
		throw new ContentInputError(
			`A note has at most ${NOTE_MAX_LENGTH} characters (this one has ${length}); write an article instead`,
		);
	return clean;
}

/**
 * Whether a viewer may see a note or an article: public items are for everyone, members-only
 * ones for members of the item's scope (or a scope below it) and role holders on it,
 * representatives-only ones for role holders. Unpublished items are for no public viewer.
 */
export async function canViewStreamItem(
	item: { visibility: string; scopeId: string; publishedAt: string | null },
	viewer: { id: string } | null,
): Promise<boolean> {
	if (!item.publishedAt) return false;
	if (item.visibility === "public") return true;
	return canViewScope(viewer, item.scopeId, item.visibility as Visibility);
}
