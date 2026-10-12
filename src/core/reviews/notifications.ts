import { createElement } from "react";
import type { NotificationDefinition } from "~/core/notifications/define";
import { defineNotification } from "~/core/notifications/define";
import NoticeEmail from "~theme/emails/Notice";

/**
 * Review notifications (spec 4.9). Both are required (cannot be muted): a reviewer must hear
 * about new submissions, an author about the decision. `data` holds the review id only; the
 * renderer loads the item's current title and URLs at send time.
 */

async function reviewContext(reviewId: string) {
	// Lazy: the registry imports every module manifest.
	const [
		{ reviewsService },
		{ locateRef, resolveRef },
		{ scopesService },
		{ adminUrl },
	] = await Promise.all([
		import("~/core/reviews/reviews.service"),
		import("~/core/registry/refs"),
		import("~/core/scopes/scopes.service"),
		import("~/core/router/scope-path"),
	]);
	const review = await reviewsService.getById(reviewId);
	if (!review) throw new Error(`Review ${reviewId} not found`);
	const [item, scope, url] = await Promise.all([
		locateRef(review.ref),
		scopesService.getById(review.scopeId),
		resolveRef(review.ref),
	]);
	return {
		review,
		title: item?.title ?? review.ref,
		scopeName: scope?.parentId === null ? "the site" : (scope?.name ?? ""),
		queueUrl: scope ? adminUrl(scope.path, "reviews") : "/admin",
		itemUrl: url,
	};
}

export const reviewRequestedNotification = defineNotification<{
	reviewId: string;
}>({
	id: "reviews.requested",
	label: "Content waiting for review",
	channels: ["email"],
	optional: false,
	render: {
		email: async (data, ctx) => {
			const c = await reviewContext(data.reviewId);
			return {
				subject: `Review requested: ${c.title}`,
				react: createElement(NoticeEmail, {
					baseUrl: ctx.appUrl,
					recipientName: ctx.recipient.name ?? "there",
					title: "Review requested",
					subtitle: c.scopeName,
					paragraphs: [
						`"${c.title}" from ${c.scopeName} is waiting for your review. It is published once a reviewer approves it.`,
					],
					quote: null,
					buttonLabel: "Open the review queue",
					buttonUrl: new URL(c.queueUrl, ctx.appUrl).toString(),
					unsubscribeUrl: ctx.unsubscribeUrl,
				}),
			};
		},
	},
});

export const reviewDecidedNotification = defineNotification<{
	reviewId: string;
}>({
	id: "reviews.decided",
	label: "Review decision",
	channels: ["email"],
	optional: false,
	render: {
		email: async (data, ctx) => {
			const c = await reviewContext(data.reviewId);
			const approved = c.review.status === "approved";
			return {
				subject: approved
					? `Approved: ${c.title}`
					: `Changes requested: ${c.title}`,
				react: createElement(NoticeEmail, {
					baseUrl: ctx.appUrl,
					recipientName: ctx.recipient.name ?? "there",
					title: approved ? "Approved" : "Not approved yet",
					subtitle: c.scopeName,
					paragraphs: [
						approved
							? `"${c.title}" was approved and is published.`
							: `"${c.title}" was not approved. You can change it and submit it again.`,
					],
					quote: c.review.comment,
					buttonLabel: approved ? "View it" : "Open your submissions",
					buttonUrl: new URL(
						(approved && c.itemUrl) || c.queueUrl,
						ctx.appUrl,
					).toString(),
					unsubscribeUrl: ctx.unsubscribeUrl,
				}),
			};
		},
	},
});

export const reviewNotifications: NotificationDefinition[] = [
	reviewRequestedNotification,
	reviewDecidedNotification,
];
