import { eq, like, or } from "drizzle-orm";
import { db, sqlite } from "~/core/db/connection";
import { redirects } from "~/core/router/schema";

/** "/germany/berlin/" → "/germany/berlin"; "/" stays "/". */
export function normalizeRedirectPath(path: string): string {
	const trimmed = `/${path.trim().replace(/^\/+|\/+$/g, "")}`;
	return trimmed;
}

/**
 * Where `pathname` moved, given the redirect rows (from → to): the longest `from` that equals
 * the path or is a whole-segment prefix of it, with the rest of the path appended
 * (`/germany/berlin/jobs/1` with `/germany/berlin` → `/france/berlin` gives
 * `/france/berlin/jobs/1`). Null when nothing matches. Pure.
 */
export function resolveRedirect(
	rows: ReadonlyMap<string, string>,
	pathname: string,
): string | null {
	const path = normalizeRedirectPath(pathname);
	const segments = path.split("/").filter(Boolean);
	for (let n = segments.length; n > 0; n--) {
		const from = `/${segments.slice(0, n).join("/")}`;
		const to = rows.get(from);
		if (to !== undefined) {
			const rest = segments.slice(n).join("/");
			if (!rest) return to;
			return to === "/" ? `/${rest}` : `${to}/${rest}`;
		}
	}
	return null;
}

let cached: Map<string, string> | null = null;
let cachedDataVersion = -1;

async function allRedirects(): Promise<Map<string, string>> {
	// SQLite's data_version changes when another connection commits (seed scripts, test
	// fixtures); writes through this module clear the cache explicitly.
	const dataVersion = sqlite.pragma("data_version", { simple: true }) as number;
	if (!cached || dataVersion !== cachedDataVersion) {
		const rows = await db.select().from(redirects);
		cached = new Map(rows.map((r) => [r.fromPath, r.toPath]));
		cachedDataVersion = dataVersion;
	}
	return cached;
}

export const redirectsService = {
	/** The new location of an old public path, or null (see `resolveRedirect`). */
	async resolve(pathname: string): Promise<string | null> {
		return resolveRedirect(await allRedirects(), pathname);
	},

	/**
	 * Record that `from` (and everything below it) now lives at `to`. Existing redirects into
	 * `from` are pointed at `to` directly, so moving twice never makes a chain, and a redirect
	 * away from `to` is dropped, since `to` is live again.
	 */
	async add(fromPath: string, toPath: string): Promise<void> {
		const from = normalizeRedirectPath(fromPath);
		const to = normalizeRedirectPath(toPath);
		if (from === to) return;
		db.transaction((tx) => {
			const pointing = tx
				.select()
				.from(redirects)
				.where(
					or(
						eq(redirects.toPath, from),
						// LIKE wildcards in a path only widen the match; the filter below is exact.
						like(redirects.toPath, `${from}/%`),
					),
				)
				.all()
				.filter((r) => r.toPath === from || r.toPath.startsWith(`${from}/`));
			for (const row of pointing) {
				const target = `${to}${row.toPath.slice(from.length)}` || "/";
				if (target === row.fromPath) {
					tx.delete(redirects)
						.where(eq(redirects.fromPath, row.fromPath))
						.run();
				} else {
					tx.update(redirects)
						.set({ toPath: target })
						.where(eq(redirects.fromPath, row.fromPath))
						.run();
				}
			}
			tx.delete(redirects).where(eq(redirects.fromPath, to)).run();
			tx.insert(redirects)
				.values({ fromPath: from, toPath: to })
				.onConflictDoUpdate({
					target: redirects.fromPath,
					set: { toPath: to, createdAt: new Date().toISOString() },
				})
				.run();
		});
		cached = null;
	},

	/** Something live (a scope or page) now exists at `path`: stop redirecting it. */
	async release(path: string): Promise<void> {
		await db
			.delete(redirects)
			.where(eq(redirects.fromPath, normalizeRedirectPath(path)));
		cached = null;
	},
};
