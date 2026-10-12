import { notes, type ReviewContext, type ReviewDecision } from "~/core";
import { eventsService } from "./services/events";

/**
 * Review handlers of events (spec 5.2), declared in the manifest's `reviews.event`. Core calls
 * them after a coordinator decides an event proposal and retries them until they succeed, so
 * both are safe to call again. Server-only.
 */

const escapeHtml = (text: string) =>
	text
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;");

/** Approved: the event is published; with "Post announcement" (default) a note about it too. */
export async function onEventApproved(
	_ctx: ReviewContext,
	decision: ReviewDecision,
): Promise<void> {
	const event = await eventsService.getById(decision.id);
	if (!event) return;
	await eventsService.setStatus(event.id, "published");
	if (!event.announceOnApproval || event.announcementNoteId) return;
	const date = new Date(event.startDate).toLocaleDateString("en-GB", {
		day: "numeric",
		month: "long",
		year: "numeric",
	});
	const note = await notes.create({
		scopeId: event.scopeId,
		subjectType: "events:event",
		subjectId: event.id,
		body: `<p>New event: <a href="ref:events:event:${event.id}">${escapeHtml(event.title)}</a> on ${date}.</p>`,
		visibility: event.visibility,
		// The organiser announces it; the note was reviewed with the event.
		authorId: decision.submittedBy,
		announcesReviewId: decision.reviewId,
	});
	await eventsService.setAnnouncementNote(event.id, note.id);
}

/** Rejected: back to draft; the organiser sees the comment on the event's Review tab. */
export async function onEventRejected(
	_ctx: ReviewContext,
	decision: ReviewDecision,
): Promise<void> {
	const event = await eventsService.getById(decision.id);
	if (event?.status === "in_review")
		await eventsService.setStatus(event.id, "draft");
}
