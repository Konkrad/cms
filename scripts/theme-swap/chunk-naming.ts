/**
 * Shared chunk-naming logic for the theme drop-in swap mechanism (see
 * docs/theme-development.md). Used from three places that all need to agree
 * on the same filenames:
 *
 *   - vite.config.ts and adapters/node-server/vite.config.ts's
 *     `output.codeSplitting.groups[0].name` — computes the name at build time.
 *   - scripts/theme-swap/extract.ts — identifies which build/server output
 *     files are theme-owned (prefix `theme-`) so they can be pulled out.
 *   - scripts/theme-swap/merge.ts — identifies the same prefix when
 *     overlaying a fork's extracted theme onto a base build.
 *
 * Only theme/-owned modules are ever named — everything else (app code,
 * framework, node_modules) returns `null`, leaving Rolldown's normal
 * bundling decisions untouched. This matters most for the SSR build: naming
 * (and thereby pulling out of its normal chunk) framework code such as
 * @qwik.dev/router's node middleware breaks it, because that code computes
 * paths (its static-file root) relative to `import.meta.url`, which only
 * resolves correctly when Rolldown bundles it the way it normally does
 * (confirmed by a real regression during development). Since the swap
 * mechanism only ever needs to extract/overlay theme code, core code was
 * never a naming target to begin with — the client build doesn't need
 * deterministic core chunk names any more than the server build does.
 */

export const THEME_PREFIX = "theme-";

// Qwik's optimizer splits every `$`-boundary into its own virtual client
// module whose id already embeds the boundary's source path (e.g.
// ".../theme/routes/events/CheckoutView.tsx_CheckoutView_component_..."),
// plus an 11-character content hash appended before the trailing ".js".
// Rolldown's default chunk naming keys off *that* hash, so two builds of
// identical source can still produce different filenames, and two builds of
// *different* theme content can't be diffed/merged file-by-file. Stripping
// it derives the name from source path alone. Server-side module ids are
// plain file paths with no such suffix (Qwik doesn't segment-split for SSR),
// so this is a no-op there.
const SEGMENT_HASH = /_[A-Za-z0-9_-]{11}(\.js)$/;
const UNSAFE_CHARS = /[^a-zA-Z0-9_.-]/g;

/**
 * Rolldown calls this once per candidate module with its absolute file path
 * (or Qwik's synthetic per-segment virtual id, which is itself an absolute
 * path with a suffix — see module doc). Returning a distinct string per
 * theme module creates a distinct chunk per module, which is what makes
 * this deterministic: two builds that produce the same set of theme module
 * ids always produce the same set of theme chunk names, regardless of
 * Rolldown's own (non-deterministic) automatic chunk-merging heuristics.
 *
 * Returns `null` for any module not under theme/, letting Rolldown fall
 * back to its default bundling for it.
 */
export function themeAwareChunkName(moduleId: string): string | null {
	if (!moduleId.includes("/theme/")) return null;
	const rel = moduleId.split("/theme/")[1];
	if (!rel) return null;

	const withoutSegmentHash = rel.replace(SEGMENT_HASH, "$1");
	const safe = withoutSegmentHash.replace(UNSAFE_CHARS, "_");
	return `${THEME_PREFIX}${safe}`;
}
