/**
 * Client-safe SEO helpers for module `head` functions. Kept out of `./index` because module view
 * registries are bundled for the browser, which must not reach the server-only core surface.
 */
export {
	canonicalUrl,
	htmlToDescription,
	jsonLdScript,
} from "~/core/content/seo";
