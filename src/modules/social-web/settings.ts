import { z } from "zod";

/**
 * Deployment settings of the social-web module (spec 5.3), read as `moduleSettings("social-web")`.
 * Environment variables `SOCIAL_WEB_<KEY>`: `SOCIAL_WEB_ACCOUNT`, `SOCIAL_WEB_SUMMARY`,
 * `SOCIAL_WEB_UPDATE_INTERVAL`, `SOCIAL_WEB_ICON`. Pure (zod only): src/env.ts validates it at
 * startup while the module is active.
 */
export const socialWebSettings = z.object({
	/** The one site-wide, pull-only account: `<account>@<APP_URL host>` (WebFinger, actor). */
	account: z
		.string()
		.regex(/^[a-z0-9][a-z0-9._-]*$/i)
		.default("news"),
	/** Actor summary and RSS channel description (empty = the site name). */
	summary: z.string().default(""),
	/** Typical time between new posts, an xsd:duration for the actor's `updateInterval` (FEP-b06c). */
	updateInterval: z
		.string()
		.regex(
			/^P(?!$)(\d+Y)?(\d+M)?(\d+W)?(\d+D)?(T(?=\d)(\d+H)?(\d+M)?(\d+S)?)?$/,
		)
		.default("P1D"),
	/** Path or URL of the actor's icon. */
	icon: z.string().default("/favicon.svg"),
});
