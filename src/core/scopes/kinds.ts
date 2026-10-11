/**
 * Kinds a new scope can have, offered when creating a child scope. Deployment configuration:
 * the tree itself does not depend on them (the root's kind is "root"). The UI calls every
 * scope a group; the kind says which sort.
 */
export const SCOPE_KINDS = ["region", "chapter"] as const;
export type ScopeKind = (typeof SCOPE_KINDS)[number];

/** Public S3 prefix of scope home page images (uploaded through /api/images). */
export const SCOPE_IMAGE_PREFIX = "public/scopes/";
