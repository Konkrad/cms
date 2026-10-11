/**
 * The root scope's kind. The kinds of the scopes below it (region, chapter, …) are deployment
 * configuration: `env.SCOPE_KINDS` (src/env.ts); the tree itself does not depend on them. The
 * UI calls every scope a group; the kind says which sort.
 */
export const ROOT_KIND = "root";

/** Public S3 prefix of scope home page images (uploaded through /api/images). */
export const SCOPE_IMAGE_PREFIX = "public/scopes/";
