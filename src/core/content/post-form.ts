import type { z as RouterZod } from "@qwik.dev/router";
import { PostInputError } from "~/core/content/posts";
import { parseRef } from "~/core/refs/refs";
import { VISIBILITIES } from "~/core/scopes/visibility";

/**
 * Fields `PostForm` posts, for `zod$(postFormSchema)` in the actions that save it (a schema
 * builder: zod$ passes the router's zod, so this file stays free of the router runtime).
 * The posts service validates the rest (visibility per author, subject, empty body).
 */
export const postFormSchema = (z: typeof RouterZod) =>
	z.object({
		title: z.string().max(200, "The title is too long").optional(),
		body: z.string().min(1, "Write something first"),
		visibility: z.enum(VISIBILITIES),
		/** `ref:<module>:<type>:<id>` from the subject picker; empty = no subject. */
		subject: z.string().optional(),
	});

/**
 * The subject columns for a picked reference (`ref:events:event:<id>` → `events:event` and the
 * id); nulls for an empty field. Throws for anything that is not an item reference.
 */
export function subjectFromField(value: string | undefined | null): {
	subjectType: string | null;
	subjectId: string | null;
} {
	if (!value?.trim()) return { subjectType: null, subjectId: null };
	const ref = parseRef(value);
	if (!ref || ref.kind !== "item")
		throw new PostInputError("Pick an item for the subject");
	return { subjectType: `${ref.module}:${ref.type}`, subjectId: ref.id };
}
