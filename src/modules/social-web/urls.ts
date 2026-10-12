import { getSiteInfo, type StreamType } from "~/core";

/** The module id (`modules.config.ts`). */
export const MODULE_ID = "social-web";

/** Site path of the RSS feed (`src/routes/feed.xml`). */
export const FEED_PATH = "/feed.xml";

/** Base path of the ActivityPoll actor's documents (`src/routes/social`). */
export const SOCIAL_PATH = "/social";

/** The site's public base URL without a trailing slash. */
export const siteBase = (): string => getSiteInfo().url.replace(/\/+$/, "");

/** An absolute URL for a site path. */
export const absoluteUrl = (path: string): string =>
	new URL(path, `${siteBase()}/`).toString();

export type ActivityVerb = "create" | "delete";

/**
 * The IRIs of the site-wide actor and its documents. Objects and activities have their own
 * JSON IRIs (dereferenceable, independent of the item's scope path, so they never change when a
 * scope is renamed); the object's `url` is its canonical HTML page.
 */
export const socialUrls = () => {
	const base = `${siteBase()}${SOCIAL_PATH}`;
	return {
		actor: `${base}/actor`,
		inbox: `${base}/inbox`,
		outbox: `${base}/outbox`,
		object: (type: StreamType, id: string) => `${base}/objects/${type}/${id}`,
		activity: (verb: ActivityVerb, type: StreamType, id: string) =>
			`${base}/activities/${verb}/${type}/${id}`,
	};
};
