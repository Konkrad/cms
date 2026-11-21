import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { basename, join, relative } from "node:path";
import { describe, expect, it } from "vitest";

// Feature notes (`<area>/features/*.md`, CLAUDE.md § Feature notes) stay next to the code they
// describe: every `code:` path must exist and every [[link]] must name another note.
const root = join(__dirname, "..", "..");

function featureNotes(dir: string): string[] {
	return readdirSync(dir).flatMap((name) => {
		const path = join(dir, name);
		if (!statSync(path).isDirectory()) return [];
		if (name === "features")
			return readdirSync(path)
				.filter((f) => f.endsWith(".md"))
				.map((f) => join(path, f));
		return featureNotes(path);
	});
}

const notes = featureNotes(join(root, "src"));
const names = notes.map((n) => basename(n, ".md"));

function codePaths(source: string): string[] {
	const frontmatter = source.match(/^---\n([\s\S]*?)\n---/)?.[1] ?? "";
	const block = frontmatter.match(/^code:\n((?:\s+- .+\n?)+)/m)?.[1] ?? "";
	return [...block.matchAll(/- (.+)/g)].map((m) => m[1].trim());
}

describe("feature notes", () => {
	it("exist", () => {
		expect(notes.length).toBeGreaterThan(0);
	});

	it("have unique names", () => {
		expect(names.length).toBe(new Set(names).size);
	});

	for (const note of notes) {
		const source = readFileSync(note, "utf8");
		const rel = relative(root, note);

		it(`${rel}: lists code paths that exist`, () => {
			const paths = codePaths(source);
			expect(paths.length, "frontmatter needs a code: list").toBeGreaterThan(0);
			expect(paths.filter((p) => !existsSync(join(root, p)))).toEqual([]);
		});

		it(`${rel}: links only to existing notes`, () => {
			const links = [...source.matchAll(/\[\[([^\]|#]+)/g)].map((m) => m[1]);
			expect(links.filter((l) => !names.includes(l))).toEqual([]);
		});
	}
});
