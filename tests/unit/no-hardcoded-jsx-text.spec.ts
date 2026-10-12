import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

// Heuristic (spec 4.8, guide 5.10): UI text in theme and module components comes from the
// catalogs through `t()`, never as literal JSX text. Flags JSX text nodes with two or more
// letters and string literals in text-carrying attributes. Not a parser of intent: strings
// built in plain TS (labels, messages) are not seen here; review keeps those in the catalog.
const root = join(__dirname, "..", "..");

const TEXT_ATTRIBUTES = new Set([
	"alt",
	"aria-label",
	"placeholder",
	"title",
	"label",
	"description",
	"heading",
	"subtitle",
	"submitLabel",
	"submittingLabel",
	"successMessage",
	"helpText",
]);

/**
 * Text that is not UI copy, with the reason. Keep this small: a translatable string belongs
 * in the catalog, not here.
 */
const ALLOWED_TEXT = new Set([
	// symbols and separators rendered as text nodes
	"•",
	// the RSS feed link label is the format's name in every language
	"RSS",
]);

function tsxFiles(dir: string): string[] {
	const out: string[] = [];
	for (const name of readdirSync(join(root, dir))) {
		const path = `${dir}/${name}`;
		if (statSync(join(root, path)).isDirectory()) out.push(...tsxFiles(path));
		else if (name.endsWith(".tsx") && !name.endsWith(".spec.tsx"))
			out.push(path);
	}
	return out;
}

const hasLetters = (text: string) => /\p{L}{2,}/u.test(text);

function hardcodedText(file: string): string[] {
	const source = readFileSync(join(root, file), "utf8");
	const sf = ts.createSourceFile(
		file,
		source,
		ts.ScriptTarget.Latest,
		true,
		ts.ScriptKind.TSX,
	);
	const found: string[] = [];
	const report = (node: ts.Node, text: string) => {
		if (ALLOWED_TEXT.has(text)) return;
		const line = sf.getLineAndCharacterOfPosition(node.getStart()).line + 1;
		found.push(`${file}:${line} ${JSON.stringify(text)}`);
	};
	const visit = (node: ts.Node) => {
		if (ts.isJsxText(node)) {
			const text = node.getText().replace(/\s+/g, " ").trim();
			if (hasLetters(text)) report(node, text);
		}
		if (
			ts.isJsxAttribute(node) &&
			node.initializer &&
			ts.isStringLiteral(node.initializer) &&
			TEXT_ATTRIBUTES.has(node.name.getText()) &&
			hasLetters(node.initializer.text)
		) {
			report(node, node.initializer.text);
		}
		ts.forEachChild(node, visit);
	};
	visit(sf);
	return found;
}

describe("no hard-coded JSX text", () => {
	for (const dir of ["theme", "src/modules"]) {
		it(`in ${dir}`, () => {
			const files = tsxFiles(dir);
			expect(files.length).toBeGreaterThan(10);
			expect(files.flatMap(hardcodedText)).toEqual([]);
		});
	}
});
