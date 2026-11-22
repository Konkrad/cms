#!/usr/bin/env node
// Feature-notes drift check: lists notes whose `code:` files changed while the note itself did not.
//
//   --hook    Claude Code Stop hook. Compares the working tree (and the branch's commits since
//             it left origin/main) with the notes; asks Claude once to review the listed notes.
//   --staged  pre-commit: compares the staged files; prints a reminder, never blocks.
//
// Plain Node, no dependencies: it runs before `npm install` and outside Vite.
import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const root = execFileSync("git", ["rev-parse", "--show-toplevel"], {
	encoding: "utf8",
}).trim();
const mode = process.argv.includes("--staged") ? "staged" : "hook";

const git = (...args) => {
	try {
		return execFileSync("git", args, { cwd: root, encoding: "utf8" })
			.split("\n")
			.map((l) => l.trim())
			.filter(Boolean);
	} catch {
		return [];
	}
};

function featureNotes(dir) {
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

function codePaths(source) {
	const frontmatter = source.match(/^---\n([\s\S]*?)\n---/)?.[1] ?? "";
	const block = frontmatter.match(/^code:\n((?:\s+- .+\n?)+)/m)?.[1] ?? "";
	return [...block.matchAll(/- (.+)/g)].map((m) =>
		m[1].trim().replace(/\/$/, ""),
	);
}

function changedFiles() {
	if (mode === "staged") return git("diff", "--cached", "--name-only");
	const base = git("merge-base", "HEAD", "origin/main")[0] ?? "HEAD";
	return [
		...new Set([
			...git("diff", "--name-only", base),
			...git("ls-files", "--others", "--exclude-standard"),
		]),
	];
}

const changed = changedFiles();
const covers = (path, file) => file === path || file.startsWith(`${path}/`);

const stale = featureNotes(join(root, "src")).flatMap((abs) => {
	const note = relative(root, abs);
	if (changed.includes(note)) return [];
	const touched = changed.filter((file) =>
		codePaths(readFileSync(abs, "utf8")).some((path) => covers(path, file)),
	);
	return touched.length ? [{ note, touched }] : [];
});

if (stale.length === 0) process.exit(0);

const list = stale
	.map(
		({ note, touched }) =>
			`- ${note}\n    changed: ${touched.slice(0, 5).join(", ")}${touched.length > 5 ? ", …" : ""}`,
	)
	.join("\n");

if (mode === "staged") {
	console.error(
		`\nFeature notes: code they describe is staged, the notes are not. Check whether a rule changed:\n${list}\n(Reminder only; the commit goes ahead.)\n`,
	);
	process.exit(0);
}

// Stop hook: ask once. On the second stop in a row Claude has had its chance to update the
// notes or to say that no rule changed, so let it finish instead of looping.
const input = (() => {
	try {
		return JSON.parse(readFileSync(0, "utf8") || "{}");
	} catch {
		return {};
	}
})();
if (input.stop_hook_active) process.exit(0);

console.log(
	JSON.stringify({
		decision: "block",
		reason: `Code described by these feature notes changed, but the notes did not:\n${list}\n\nLoad the feature-notes skill. For each note: if a rule, flow or decision changed, update the note (Rules, Decisions, diagram) and commit it with the code. If nothing a person would notice changed, say so in one line and finish.`,
	}),
);
