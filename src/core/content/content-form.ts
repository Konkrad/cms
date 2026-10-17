import type { z as RouterZod } from "@qwik.dev/router";
import {
	ARTICLE_TITLE_MAX_LENGTH,
	ContentInputError,
} from "~/core/content/content-items";
import { t } from "~/core/i18n";
import { parseRef } from "~/core/refs/refs";
import { VISIBILITIES } from "~/core/scopes/visibility";

/**
 * Fields `NoteForm` and `ArticleForm` post, for `zod$(noteFormSchema)` /
 * `zod$(articleFormSchema)` in the actions that save them (schema builders: zod$ passes the
 * router's zod, so this file stays free of the router runtime). The services validate the rest
 * (visibility per author, subject, note length, image key, empty body).
 */
export const noteFormSchema = (z: typeof RouterZod) =>
	z.object({
		body: z.string().min(1, t("core.content.writeSomethingFirst")),
		visibility: z.enum(VISIBILITIES),
		/** `ref:<module>:<type>:<id>` from the subject picker; empty = no subject. */
		subject: z.string().optional(),
	});

export const articleFormSchema = (z: typeof RouterZod) =>
	z.object({
		title: z
			.string()
			.trim()
			.min(1, t("core.content.articleNeedsTitle"))
			.max(ARTICLE_TITLE_MAX_LENGTH, t("core.content.titleTooLong")),
		/** The uploaded image's S3 key (`public/articles/…`); empty = none. */
		featuredImage: z.string().optional(),
		body: z.string().min(1, t("core.content.writeSomethingFirst")),
		visibility: z.enum(VISIBILITIES),
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
		throw new ContentInputError(t("core.content.pickSubject"));
	return { subjectType: `${ref.module}:${ref.type}`, subjectId: ref.id };
}
