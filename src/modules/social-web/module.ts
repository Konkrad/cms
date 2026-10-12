import { defineModule, t } from "~/core";
import { FEED_PATH, MODULE_ID, SOCIAL_PATH } from "./urls";

/**
 * Social web (spec 5.3): the site's public, approved notes and articles as an RSS 2.0 feed and
 * as one site-wide, pull-only ActivityPoll actor (FEP-b06c). Nothing is ever sent: readers and
 * other servers fetch from us. No tables of its own; it reads core's `publicFeed`.
 */
export const socialWebModule = defineModule({
	id: MODULE_ID,
	routes: [FEED_PATH.slice(1), SOCIAL_PATH.slice(1)],
	feeds: [
		{
			title: t("social-web.module.news"),
			href: FEED_PATH,
			type: "application/rss+xml",
		},
	],
});
