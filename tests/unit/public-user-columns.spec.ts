/**
 * Services are the privacy boundary: a relational query that loads a user must select
 * public columns (`with: { user: { columns: publicUserColumns } }`) or an explicit
 * column list. `user: true` loads the whole users row (login id, location, birth year,
 * consent, role, private S3 keys) and has leaked into pages before.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = path.resolve(__dirname, "../..");
const SCAN_DIRS = ["src"];

function listSourceFiles(dir: string): string[] {
	const out: string[] = [];
	for (const name of readdirSync(dir)) {
		const full = path.join(dir, name);
		if (statSync(full).isDirectory()) out.push(...listSourceFiles(full));
		else if (/\.(ts|tsx)$/.test(name) && !/\.spec\.tsx?$/.test(name))
			out.push(full);
	}
	return out;
}

const files = SCAN_DIRS.flatMap((d) => listSourceFiles(path.join(ROOT, d)));

/** Relation names that point at the users table, read from every relations definition. */
function userRelationNames(sources: string[]): Set<string> {
	const names = new Set<string>();
	const re =
		/(\w+)\s*:\s*(?:one|many|r\.one|r\.many|one\.|many\.)\.?\s*(?:users\s*\(|\(\s*users\b)/g;
	for (const src of sources) {
		for (const m of src.matchAll(re)) names.add(m[1]);
	}
	return names;
}

/** Index just past the brace that closes the one at `open`. */
function matchBrace(src: string, open: number): number {
	let depth = 0;
	for (let i = open; i < src.length; i++) {
		if (src[i] === "{") depth++;
		else if (src[i] === "}") {
			depth--;
			if (depth === 0) return i + 1;
		}
	}
	return src.length;
}

/** `with:` blocks whose user relations load the whole row. One message per offence. */
export function findUnrestrictedUserLoads(
	src: string,
	relationNames: Set<string>,
): string[] {
	const problems: string[] = [];
	const alt = [...relationNames].join("|");
	if (!alt) return problems;
	for (const w of src.matchAll(/\bwith\s*:\s*\{/g)) {
		const open = (w.index ?? 0) + w[0].length - 1;
		const block = src.slice(open, matchBrace(src, open));
		for (const m of block.matchAll(
			new RegExp(`\\b(${alt})\\s*:\\s*(true|\\{)`, "g"),
		)) {
			const line = src.slice(0, open + (m.index ?? 0)).split("\n").length;
			if (m[2] === "true") {
				problems.push(`line ${line}: \`${m[1]}: true\``);
				continue;
			}
			const innerOpen = (m.index ?? 0) + m[0].length - 1;
			const inner = block.slice(innerOpen, matchBrace(block, innerOpen));
			if (!/\bcolumns\s*:/.test(inner)) {
				problems.push(`line ${line}: \`${m[1]}: {…}\` without \`columns\``);
			}
		}
	}
	return problems;
}

const sources = files.map((f) => readFileSync(f, "utf8"));
const relationNames = userRelationNames(sources);

describe("relational queries load users with public columns only", () => {
	it("finds the relations that point at users", () => {
		for (const name of ["user", "buyer", "creator", "deletedByUser"]) {
			expect(relationNames.has(name)).toBe(true);
		}
	});

	it("flags full-row user loads (self-check)", () => {
		const names = new Set(["user", "buyer"]);
		expect(
			findUnrestrictedUserLoads(
				"db.query.x.findMany({ with: { user: true } })",
				names,
			),
		).toHaveLength(1);
		expect(
			findUnrestrictedUserLoads(
				"findMany({ with: { product: true, buyer: { where: { a: 1 } } } })",
				names,
			),
		).toHaveLength(1);
		expect(
			findUnrestrictedUserLoads(
				"findMany({ with: { user: { columns: publicUserColumns }, product: true } })",
				names,
			),
		).toEqual([]);
		expect(
			findUnrestrictedUserLoads(
				"findMany({ with: { products: true } })",
				names,
			),
		).toEqual([]);
	});

	it("no file in src/ (including src/modules/) loads a full users row through `with:`", () => {
		const offences = files.flatMap((file, i) =>
			findUnrestrictedUserLoads(sources[i], relationNames).map(
				(p) => `${path.relative(ROOT, file)} ${p}`,
			),
		);
		expect(offences).toEqual([]);
	});
});
