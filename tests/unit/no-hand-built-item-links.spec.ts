import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

// Outgoing links are never built by hand (spec 4.3): an item's URL lives under its owning
// scope, so code that writes `/events/${id}` links to the wrong place once the item belongs
// to a chapter. Loaders compute URLs with `itemUrl` / `withItemUrls` (or resolve stored
// references) and contracts carry `url` fields; the theme only renders them.
const root = join(__dirname, "..", "..");

/** Path segments of public item pages (core notes and articles, and every module with detail pages). */
const ITEM_SEGMENTS = [
	"events",
	"notes",
	"articles",
	"jobs",
	"deals",
	"elections",
];

const segments = ITEM_SEGMENTS.join("|");
/** `/events/${…}` in a template literal (not `private/events/${…}` S3 keys). */
const TEMPLATE_LINK = new RegExp(`(?<![\\w.-])/(${segments})/\\$\\{`);
/** `"/events/" + id` string concatenation. */
const CONCAT_LINK = new RegExp(`["'\`]/(${segments})/["'\`]\\s*\\+`);

/**
 * Files that may build such a path by hand, with the reason. Admin URLs (`/admin/<scope>/
 * events/<id>`) are not public item links: admin files (`src/routes/admin/**`, a module's
 * `admin/` folder) and lines mentioning admin are skipped.
 */
const ALLOWED: Array<{ file: string; reason: string }> = [];

const isAdminLine = (line: string) => /admin/i.test(line);

function sourceFiles(dir: string): string[] {
	return readdirSync(dir).flatMap((name) => {
		const path = join(dir, name);
		if (statSync(path).isDirectory()) return sourceFiles(path);
		return /\.(ts|tsx)$/.test(name) ? [path] : [];
	});
}

/** `file:line: text` for every hand-built item link in `source`. */
function handBuiltLinks(file: string, source: string): string[] {
	return source
		.split("\n")
		.flatMap((line, i) =>
			(TEMPLATE_LINK.test(line) || CONCAT_LINK.test(line)) && !isAdminLine(line)
				? [`${file}:${i + 1}: ${line.trim()}`]
				: [],
		);
}

describe("hand-built item links", () => {
	it("src/ and theme/ build no item URLs by hand", () => {
		const offenders = [
			...sourceFiles(join(root, "src")),
			...sourceFiles(join(root, "theme")),
		]
			.map((path) => relative(root, path))
			.filter((file) => !/(^|\/)admin\//.test(file))
			.filter((file) => !ALLOWED.some((a) => a.file === file))
			.flatMap((file) =>
				handBuiltLinks(file, readFileSync(join(root, file), "utf8")),
			);
		expect(offenders).toEqual([]);
	});

	it("detects template and concatenated links, not admin URLs or S3 keys", () => {
		const hits = (code: string) => handBuiltLinks("x.tsx", code).length;
		expect(hits("<a href={`/events/${event.id}`}>")).toBe(1);
		expect(hits("const url = `${ctx.appUrl}/jobs/${data.jobId}`;")).toBe(1);
		expect(hits('href={"/notes/" + note.id}')).toBe(1);
		expect(hits("<a href={`/articles/${article.id}`}>")).toBe(1);
		expect(hits("throw event.redirect(302, `/elections/${id}/apply`);")).toBe(
			1,
		);
		expect(hits("href={`${data.adminBase}/jobs/${job.id}/edit`}")).toBe(0);
		expect(hits("const key = `private/events/${id}/photos`;")).toBe(0);
		expect(hits("href={`/archive/articles/${page + 1}`}")).toBe(0);
		expect(hits("href={event.url}")).toBe(0);
	});
});
