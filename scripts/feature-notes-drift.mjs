#!/usr/bin/env node
// Feature-notes drift check: lists notes whose `code:` files changed while the note itself did not.
//
//   --hook    Claude Code Stop hook. Compares the working tree (and the branch's commits since
//             it left origin/main) with the notes; asks Claude to review the listed notes, and
//             to check the notes it edited against the short checklist. Each finding is reported
//             once: it comes back only when its files change again (state in the git directory,
//             never committed).
//   --staged  pre-commit: compares the staged files; prints a reminder, never blocks.
//
// Plain Node, no dependencies: it runs before `npm install` and outside Vite.
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
	existsSync,
	readdirSync,
	readFileSync,
	statSync,
	writeFileSync,
} from "node:fs";
import { isAbsolute, join, relative } from "node:path";

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

const list = (items) =>
	items
		.map(
			({ note, touched }) =>
				`- ${note}\n    changed: ${touched.slice(0, 5).join(", ")}${touched.length > 5 ? ", …" : ""}`,
		)
		.join("\n");

if (mode === "staged") {
	if (stale.length)
		console.error(
			`\nFeature notes: code they describe is staged, the notes are not. Check whether a rule changed:\n${list(stale)}\n(Reminder only; the commit goes ahead.)\n`,
		);
	process.exit(0);
}

// Stop hook. On the second stop in a row Claude has had its chance to update the notes or to say
// that no rule changed, so let it finish instead of looping.
const input = (() => {
	try {
		return JSON.parse(readFileSync(0, "utf8") || "{}");
	} catch {
		return {};
	}
})();
if (input.stop_hook_active) process.exit(0);

// Report each finding once: remember a fingerprint of the files behind it and stay quiet until
// they change again. A note answered with "no rule changed" does not come back every turn.
const statePath = (() => {
	const path = git("rev-parse", "--git-path", "feature-notes-reviewed.json")[0];
	return path && !isAbsolute(path) ? join(root, path) : path;
})();
const reviewed = (() => {
	try {
		return statePath && existsSync(statePath)
			? JSON.parse(readFileSync(statePath, "utf8"))
			: {};
	} catch {
		return {};
	}
})();
const fingerprint = (files) => {
	const hash = createHash("sha256");
	for (const file of [...files].sort()) {
		const abs = join(root, file);
		hash.update(file);
		hash.update(existsSync(abs) ? readFileSync(abs) : "(deleted)");
	}
	return hash.digest("hex");
};
const fresh = (key, files) => {
	const print = fingerprint(files);
	if (reviewed[key] === print) return false;
	reviewed[key] = print;
	return true;
};

const newStale = stale.filter(({ note, touched }) =>
	fresh(`code:${note}`, touched),
);
// Notes edited on this branch: being edited is not the same as being current.
const editedNotes = featureNotes(join(root, "src"))
	.map((abs) => relative(root, abs))
	.filter((note) => changed.includes(note))
	.filter((note) => fresh(`note:${note}`, [note]));

if (newStale.length === 0 && editedNotes.length === 0) process.exit(0);
if (statePath) writeFileSync(statePath, JSON.stringify(reviewed, null, 2));

const parts = [];
if (newStale.length)
	parts.push(
		`Code described by these feature notes changed, but the notes did not:\n${list(newStale)}\n\nFor each note: if a rule, flow or decision changed, update the note (Rules, Decisions, diagram) and commit it with the code. If nothing a person would notice changed, say so in one line.`,
	);
if (editedNotes.length)
	parts.push(
		`These feature notes were edited:\n${editedNotes.map((n) => `- ${n}`).join("\n")}\n\nCheck each against the feature-notes skill: the intro and diagram still describe the feature as it is now; every rule matches the code; labels match what the screens say; decisions are dated, open points listed as **Open:**; no code names in the text. Fix what is off, or say in one line that it is current.`,
	);
console.log(
	JSON.stringify({
		decision: "block",
		reason: `Load the feature-notes skill.\n\n${parts.join("\n\n")}\n\nEach item is reported once; it comes back only when its files change again.`,
	}),
);
