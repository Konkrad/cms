import { $, component$, useSignal } from "@qwik.dev/core";
import type { ActionStore } from "@qwik.dev/router";
import { Button } from "~/components/ui/Button";
import { ImageUploader } from "~/components/ui/ImageUploader/ImageUploader";
import { Input } from "~/components/ui/Input";
import { VisibilitySelector } from "~/core/admin/VisibilitySelector";
import { ARTICLE_IMAGE_PATH } from "~/core/content/content-items";
import { BlockNoteEditor } from "~/core/content/editor";
import { t } from "~/core/i18n";
import type { Visibility } from "~/core/scopes/visibility";
import { type ContentFormActionValue, FormMessages } from "./form-result";
import { SubjectPicker } from "./SubjectPicker";

export interface ArticleFormValues {
	title: string;
	/** Stored HTML; the editor parses it into blocks. */
	body: string;
	visibility: Visibility;
	/** The stored image key and its public URL, if the article has an image. */
	image?: { key: string; url: string } | null;
	subject?: { href: string; label: string } | null;
}

/**
 * The article editor (spec 4.4): required title, optional featured image (cropped, uploaded
 * to `public/articles` on save), full rich text, visibility (`allowedVisibilities`) and, with
 * `subjectPicker`, the item the article is about. Posts `title`, `featuredImage` (the S3 key),
 * `body`, `visibility` and `subject` to `action` once the image is uploaded; the action
 * authorizes and validates (`articles.create` / `update`). Used by the core articles admin and
 * by modules (`~/core/ui`, e.g. an event's Updates tab).
 */
export const ArticleForm = component$<{
	// biome-ignore lint/suspicious/noExplicitAny: any action whose result is a ContentFormActionValue
	action: ActionStore<ContentFormActionValue, any, any>;
	visibilities: readonly Visibility[];
	values?: ArticleFormValues;
	subjectPicker?: boolean;
	submitLabel?: string;
	cancelHref?: string;
	successMessage?: string;
}>((props) => {
	const values = props.values;
	const body = useSignal(values?.body ?? "");
	const formRef = useSignal<HTMLFormElement>();
	const triggerUpload = useSignal(false);
	const uploading = useSignal(false);
	const removeImage = useSignal(false);

	// The image (if one was picked) is uploaded first; then the form is posted with its key.
	const submit = $(async () => {
		if (removeImage.value) {
			// No uploader on the page: post right away.
			if (formRef.value) await props.action.submit(new FormData(formRef.value));
			return;
		}
		uploading.value = true;
		triggerUpload.value = true;
	});
	const onUploadSettled = $(async () => {
		triggerUpload.value = false;
		if (formRef.value) await props.action.submit(new FormData(formRef.value));
		uploading.value = false;
	});

	const busy = uploading.value || props.action.isRunning;
	return (
		<form
			ref={formRef}
			preventdefault:submit
			onSubmit$={submit}
			class="space-y-6"
			data-testid="article-form"
		>
			<Input
				name="title"
				label={t("admin.articleForm.title")}
				value={values?.title ?? ""}
				placeholder={t("admin.articleForm.whatIsTheArticleAbout")}
				required
			/>

			<div>
				<p class="text-sm font-medium text-gray-700 mb-1">
					{t("admin.articleForm.featuredImageOptional")}
				</p>
				{removeImage.value ? (
					<input type="hidden" name="featuredImage" value="" />
				) : (
					<ImageUploader
						name="featuredImage"
						path={ARTICLE_IMAGE_PATH}
						aspectRatio="1/1"
						crop
						cropAspectRatio="1/1"
						triggerSignal={triggerUpload}
						onSettled$={onUploadSettled}
						currentUrl={values?.image?.url}
						currentValue={values?.image?.key}
					/>
				)}
				{values?.image && (
					<label class="mt-2 flex items-center gap-2 text-sm text-gray-700">
						<input
							type="checkbox"
							checked={removeImage.value}
							onChange$={(_, el) => {
								removeImage.value = el.checked;
							}}
						/>
						{t("admin.articleForm.removeTheImage")}
					</label>
				)}
			</div>

			<div>
				<p class="block text-sm font-medium text-gray-700 mb-2">
					{t("admin.articleForm.text")}
				</p>
				<div class="border border-gray-300 rounded-lg overflow-hidden">
					<BlockNoteEditor
						editorState={null}
						content={values?.body ?? ""}
						onChange$={(html: string) => {
							body.value = html;
						}}
						uploadUrl="/api/images"
						linkPicker
					/>
				</div>
				<input type="hidden" name="body" value={body.value} />
			</div>

			{props.subjectPicker && <SubjectPicker value={values?.subject ?? null} />}

			<VisibilitySelector
				name="visibility"
				value={
					values && props.visibilities.includes(values.visibility)
						? values.visibility
						: props.visibilities[0]
				}
				options={props.visibilities}
			/>

			<FormMessages
				value={props.action.value}
				successMessage={props.successMessage}
			/>

			<div class="flex gap-4">
				<Button type="submit" disabled={busy}>
					{busy
						? t("admin.articleForm.saving")
						: (props.submitLabel ?? t("admin.articleForm.save"))}
				</Button>
				{props.cancelHref && (
					<Button href={props.cancelHref} variant="secondary">
						{t("admin.articleForm.cancel")}
					</Button>
				)}
			</div>
		</form>
	);
});
