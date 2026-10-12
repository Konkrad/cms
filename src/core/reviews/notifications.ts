import { createElement } from "react";
import { t } from "~/core/i18n";
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
		scopeName:
			scope?.parentId === null
				? t("core.reviews.theSite")
				: (scope?.name ?? ""),
		queueUrl: scope ? adminUrl(scope.path, "reviews") : "/admin",
		itemUrl: url,
	};
}

export const reviewRequestedNotification = defineNotification<{
	reviewId: string;
}>({
	id: "reviews.requested",
	label: t("core.reviews.requested.label"),
	channels: ["email"],
	optional: false,
	render: {
		email: async (data, ctx) => {
			const c = await reviewContext(data.reviewId);
			return {
				subject: t("core.reviews.requested.subject", { title: c.title }),
				react: createElement(NoticeEmail, {
					baseUrl: ctx.appUrl,
					recipientName: ctx.recipient.name ?? t("core.email.fallbackName"),
					title: t("core.reviews.requested.title"),
					subtitle: c.scopeName,
					paragraphs: [
						t("core.reviews.requested.body", {
							title: c.title,
							scopeName: c.scopeName,
						}),
					],
					quote: null,
					buttonLabel: t("core.reviews.requested.button"),
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
	label: t("core.reviews.decided.label"),
	channels: ["email"],
	optional: false,
	render: {
		email: async (data, ctx) => {
			const c = await reviewContext(data.reviewId);
			const approved = c.review.status === "approved";
			return {
				subject: approved
					? t("core.reviews.decided.approvedSubject", { title: c.title })
					: t("core.reviews.decided.rejectedSubject", { title: c.title }),
				react: createElement(NoticeEmail, {
					baseUrl: ctx.appUrl,
					recipientName: ctx.recipient.name ?? t("core.email.fallbackName"),
					title: approved
						? t("core.reviews.decided.approvedTitle")
						: t("core.reviews.decided.rejectedTitle"),
					subtitle: c.scopeName,
					paragraphs: [
						approved
							? t("core.reviews.decided.approvedBody", { title: c.title })
							: t("core.reviews.decided.rejectedBody", { title: c.title }),
					],
					quote: c.review.comment,
					buttonLabel: approved
						? t("core.reviews.decided.viewIt")
						: t("core.reviews.decided.openSubmissions"),
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
