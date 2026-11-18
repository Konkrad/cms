import { component$ } from "@qwik.dev/core";
import { Link } from "@qwik.dev/router";
import { t } from "~/contracts/i18n";
import type { NoteViewData } from "~/contracts/notes";
import { Avatar } from "~theme/shared/StreamList/Avatar";
import { formatStreamDate } from "~theme/shared/StreamList/card-meta";
import { StreamList } from "~theme/shared/StreamList/StreamList";

/**
 * Themed presentation for a single note (`<scope path>/notes/:id`): the text is the note, shown
 * like a status update with its author. Pure view: `note.body` is sanitized server-side.
 */
export const NoteView = component$<{ note: NoteViewData | null }>(
	({ note }) => {
		if (!note) {
			return (
				<div class="max-w-4xl mx-auto px-4 py-16 text-center">
					<h1 class="text-4xl font-bold text-text-heading mb-4">
						{t("theme.note.noteNotFound")}
					</h1>
					<p class="text-text-secondary mb-8">
						{t("theme.note.theNoteYouReLooking")}
					</p>
					<Link href="/" class="text-primary hover:text-primary font-medium">
						{t("theme.note.goBackHome")}
					</Link>
				</div>
			);
		}

		return (
			<div class="max-w-2xl mx-auto px-4 sm:px-6 py-10">
				<article class="bg-bg-card border border-border p-6" data-layout="note">
					<header class="flex items-center gap-3 mb-4">
						<Avatar
							displayName={note.author.displayName}
							avatarUrl={note.author.avatarUrl}
						/>
						<div>
							<Link
								href={note.author.profileUrl}
								class="font-semibold text-text-heading hover:text-primary"
							>
								{note.author.displayName}
							</Link>
							<time
								dateTime={note.publishedAt}
								class="block text-sm text-text-muted"
							>
								{formatStreamDate(note.publishedAt)}
							</time>
						</div>
					</header>
					{note.subject && (
						<p class="text-sm text-text-secondary mb-4">
							{t("theme.note.about")}{" "}
							<Link
								href={note.subject.url}
								class="text-primary hover:underline"
							>
								{note.subject.title}
							</Link>
						</p>
					)}
					<div
						class="prose prose-lg max-w-none text-text"
						dangerouslySetInnerHTML={note.body}
					/>
				</article>
				{note.related.length > 0 && (
					<section class="mt-16 pt-10 border-t border-border">
						<h2 class="text-2xl font-bold text-text-heading mb-8 text-center">
							{t("theme.note.moreNews")}
						</h2>
						<StreamList items={note.related} />
					</section>
				)}
			</div>
		);
	},
);
