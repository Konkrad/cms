/**
 * Who may see a scoped item (spec 4.2). Client-safe: no server imports.
 * - `public`: everyone; also listed on every ancestor scope (content flows up).
 * - `members`: members of the owning scope or of any scope below it, and role holders on it.
 * - `representatives`: role holders on the owning scope (inherited from above) only.
 */
export const VISIBILITIES = ["public", "members", "representatives"] as const;
export type Visibility = (typeof VISIBILITIES)[number];
