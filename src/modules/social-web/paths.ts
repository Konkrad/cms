/**
 * Paths of the social-web module. No imports: the raw request hook (`raw-request.ts`, loaded by
 * vite.config.ts and the production server before the app) uses them too.
 */

/** The module id (`modules.config.ts`). */
export const MODULE_ID = "social-web";

/** Site path of the RSS feed (`src/routes/feed.xml`). */
export const FEED_PATH = "/feed.xml";

/** Base path of the ActivityPoll actor's documents (`src/routes/social`). */
export const SOCIAL_PATH = "/social";

/** The poll-only inbox: every write answers 405 (FEP-b06c). */
export const INBOX_PATH = `${SOCIAL_PATH}/inbox`;
