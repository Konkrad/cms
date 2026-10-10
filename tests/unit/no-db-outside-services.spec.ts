import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

// Services are the privacy boundary (CLAUDE.md § Security): only service code may query the
// database. Route files, loaders, actions, pages and components call services instead.
const root = join(__dirname, "..", "..");

/** Files allowed to import `db`: services, and the payment handlers that do fulfilment writes. */
const isServiceFile = (path: string) =>
	/(^|\/)services\//.test(path) ||
	/(^|\/)service\.ts$/.test(path) ||
	/\.service\.ts$/.test(path) ||
	/^modules\/[^/]+\/payments\.ts$/.test(path);

const DB_IMPORT =
	/import\s*(?:type\s*)?\{([^}]*)\}\s*from\s*"(~\/core|~\/core\/db\/connection)"/g;

function sourceFiles(dir: string): string[] {
	return readdirSync(dir).flatMap((name) => {
		const path = join(dir, name);
		if (statSync(path).isDirectory()) return sourceFiles(path);
		return /\.(ts|tsx)$/.test(name) ? [path] : [];
	});
}

function importsDb(source: string): boolean {
	for (const match of source.matchAll(DB_IMPORT)) {
		const names = match[1].split(",").map((n) => n.trim().split(/\s+as\s+/)[0]);
		if (names.includes("db")) return true;
	}
	return false;
}

describe("db access outside services", () => {
	it("routes, loaders, actions and components never import db", () => {
		const offenders = [
			...sourceFiles(join(root, "src", "routes")),
			...sourceFiles(join(root, "modules")),
		]
			.map((path) => relative(root, path))
			.filter((path) => !isServiceFile(path))
			.filter((path) => importsDb(readFileSync(join(root, path), "utf8")));

		expect(offenders).toEqual([]);
	});

	it("detects a multi-line db import", () => {
		expect(importsDb('import {\n\tdb,\n\tdefinePage,\n} from "~/core";')).toBe(
			true,
		);
		expect(importsDb('import { definePage } from "~/core";')).toBe(false);
	});
});
