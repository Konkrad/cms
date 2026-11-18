import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

// CLAUDE.md § Security / spec 7: an action runs BEFORE the route's loaders, so every mutating
// handler must authorize as its FIRST statement (before any `try`). This test scans every
// `routeAction$` / `globalAction$` and every API `onPost/onPut/onPatch/onDelete` handler and
// fails when the first statement of its body is not a call to an auth helper.
const root = join(__dirname, "..", "..");

/** The shared auth helpers. A function whose own first statement calls one counts as one too. */
export const AUTH_HELPERS = [
	"requireAuth",
	"requireAdmin",
	"requireScopeRole",
	"requireSystemAdmin",
	"requireModuleAdmin",
	"requireModuleAuth",
];

/**
 * Handlers that are public on purpose, by `<file>#<name>` (the name is the exported const, or
 * the handler name for API routes). Each entry says why it needs no login.
 */
export const PUBLIC_HANDLERS: Record<string, string> = {
	// Logging in cannot require a login: both steps are rate-limited and ALTCHA-protected.
	"src/routes/login/index.tsx#useSendAction":
		"login: sends the OTP / magic link",
	"src/routes/login/index.tsx#useVerifyAction":
		"login: checks the emailed code",
	// Logging out only deletes the caller's own session cookie and row.
	"src/routes/layout.tsx#useLogoutAction": "logout of the caller's own session",
	// RFC 8058 one-click unsubscribe: mail clients POST without a session; the signed,
	// expiring token in the URL is the authorization.
	"src/routes/api/notifications/unsubscribe/index.ts#onPost":
		"one-click unsubscribe, authorized by the signed token",
	// Payment providers call it without a session; the handler verifies the webhook
	// signature before anything else (spec 4.7).
	"src/routes/api/payments/webhook/[provider]/index.ts#onPost":
		"payment provider webhook, authorized by the signature",
	// Public forms (surveys) accept guest answers; the handler checks the form is public.
	"src/routes/api/forms/[id]/submit/index.ts#onPost":
		"public survey submission, checked against the form's visibility",
};

const MUTATING_HANDLERS = new Set(["onPost", "onPut", "onPatch", "onDelete"]);
const ACTION_FACTORIES = new Set(["routeAction$", "globalAction$"]);

function sourceFiles(dir: string): string[] {
	return readdirSync(dir).flatMap((name) => {
		const path = join(dir, name);
		if (statSync(path).isDirectory()) return sourceFiles(path);
		return /\.(ts|tsx)$/.test(name) && !/\.spec\.tsx?$/.test(name)
			? [path]
			: [];
	});
}

type FnNode = ts.ArrowFunction | ts.FunctionExpression | ts.FunctionDeclaration;

const isFn = (node: ts.Node | undefined): node is FnNode =>
	!!node &&
	(ts.isArrowFunction(node) ||
		ts.isFunctionExpression(node) ||
		ts.isFunctionDeclaration(node));

/** Name of the function called by `expr` (unwrapping `await`, parentheses and `x.y` calls). */
function calledName(expr: ts.Expression | undefined): string | null {
	let e = expr;
	while (e && (ts.isAwaitExpression(e) || ts.isParenthesizedExpression(e))) {
		e = e.expression;
	}
	if (!e || !ts.isCallExpression(e)) return null;
	const callee = e.expression;
	if (ts.isIdentifier(callee)) return callee.text;
	if (ts.isPropertyAccessExpression(callee)) return callee.name.text;
	return null;
}

/** The call a function starts with: its first statement, or its expression body. */
export function firstCallOf(fn: FnNode): string | null {
	const body = fn.body;
	if (!body) return null;
	if (!ts.isBlock(body)) return calledName(body as ts.Expression);
	const first = body.statements[0];
	if (!first) return null;
	if (ts.isExpressionStatement(first)) return calledName(first.expression);
	if (ts.isReturnStatement(first)) return calledName(first.expression);
	if (ts.isVariableStatement(first)) {
		const decl = first.declarationList.declarations[0];
		return calledName(decl?.initializer);
	}
	return null;
}

export interface Handler {
	file: string;
	name: string;
	fn: FnNode | null;
}

interface Scan {
	handlers: Handler[];
	/** Every named function in the scanned files, by name. */
	functions: Map<string, FnNode[]>;
}

export function scanSource(file: string, source: string, into: Scan): void {
	const sf = ts.createSourceFile(
		file,
		source,
		ts.ScriptTarget.Latest,
		true,
		file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
	);
	const addFn = (name: string, fn: FnNode) => {
		const list = into.functions.get(name) ?? [];
		list.push(fn);
		into.functions.set(name, list);
	};

	const visit = (node: ts.Node) => {
		if (ts.isFunctionDeclaration(node) && node.name) {
			addFn(node.name.text, node);
		}
		if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name)) {
			const name = node.name.text;
			const init = node.initializer;
			if (isFn(init)) {
				addFn(name, init);
				if (MUTATING_HANDLERS.has(name)) {
					into.handlers.push({ file, name, fn: init });
				}
			}
			if (
				init &&
				ts.isCallExpression(init) &&
				ts.isIdentifier(init.expression) &&
				ACTION_FACTORIES.has(init.expression.text)
			) {
				const arg = init.arguments[0];
				into.handlers.push({ file, name, fn: isFn(arg) ? arg : null });
			}
		}
		ts.forEachChild(node, visit);
	};
	visit(sf);
}

/** Auth helpers plus every scanned function that itself starts with one (to a fixpoint). */
export function authGuards(functions: Map<string, FnNode[]>): Set<string> {
	const guards = new Set(AUTH_HELPERS);
	let grew = true;
	while (grew) {
		grew = false;
		for (const [name, fns] of functions) {
			if (guards.has(name)) continue;
			if (
				fns.every((fn) => {
					const called = firstCallOf(fn);
					return !!called && guards.has(called);
				})
			) {
				guards.add(name);
				grew = true;
			}
		}
	}
	return guards;
}

export function unauthorizedHandlers(
	scan: Scan,
	publicHandlers: Record<string, string> = PUBLIC_HANDLERS,
): string[] {
	const guards = authGuards(scan.functions);
	return scan.handlers
		.filter((h) => !publicHandlers[`${h.file}#${h.name}`])
		.filter((h) => {
			if (!h.fn) return true;
			const called = firstCallOf(h.fn);
			return !called || !guards.has(called);
		})
		.map((h) => `${h.file}#${h.name}`);
}

function scanDirs(dirs: string[]): Scan {
	const scan: Scan = { handlers: [], functions: new Map() };
	for (const dir of dirs) {
		for (const path of sourceFiles(join(root, dir))) {
			scanSource(relative(root, path), readFileSync(path, "utf8"), scan);
		}
	}
	return scan;
}

describe("every action and mutating API handler authorizes first", () => {
	const scan = scanDirs(["src/routes", "src/modules", "src/core"]);

	it("finds the handlers", () => {
		expect(scan.handlers.length).toBeGreaterThan(40);
	});

	it("starts each with an auth helper (or is allow-listed as public)", () => {
		expect(unauthorizedHandlers(scan)).toEqual([]);
	});

	it("allow-lists only handlers that exist", () => {
		const names = new Set(scan.handlers.map((h) => `${h.file}#${h.name}`));
		expect(Object.keys(PUBLIC_HANDLERS).filter((k) => !names.has(k))).toEqual(
			[],
		);
	});
});

describe("the rule itself", () => {
	const check = (source: string) => {
		const scan: Scan = { handlers: [], functions: new Map() };
		scanSource("x.ts", source, scan);
		return unauthorizedHandlers(scan, {});
	};

	it("accepts an auth helper as the first statement", () => {
		expect(
			check(`export const useA = routeAction$(async (d, event) => {
				const user = await requireAuth(event);
				await doIt(user);
			});`),
		).toEqual([]);
		expect(
			check(`export const useB = routeAction$(async (d, event) => {
				await requireScopeRole(event, "representative");
			});`),
		).toEqual([]);
	});

	it("accepts a guard that itself starts with an auth helper", () => {
		expect(
			check(`async function requireThing(event) {
				const ctx = await requireModuleAdmin(event, { module: "x", scope: "any" });
				return ctx;
			}
			export const useC = routeAction$(async (d, event) => {
				const { scope } = await requireThing(event);
			});`),
		).toEqual([]);
	});

	it("rejects auth after other work, inside try, or missing", () => {
		expect(
			check(`export const useD = routeAction$(async (d, event) => {
				await db.insert(x);
				await requireAuth(event);
			});
			export const useE = routeAction$(async (d, event) => {
				try { await requireAuth(event); } catch {}
			});
			export const useF = globalAction$(async () => ({ ok: true }));`),
		).toEqual(["x.ts#useD", "x.ts#useE", "x.ts#useF"]);
	});

	it("checks mutating API handlers but not onGet", () => {
		expect(
			check(`export const onPost = async (event) => { await save(event); };
			export const onGet = async (event) => { await read(event); };
			export const onDelete = async (event) => { await requireAdmin(event); };`),
		).toEqual(["x.ts#onPost"]);
	});

	it("rejects a handler passed by reference", () => {
		expect(check(`export const useG = routeAction$(handler);`)).toEqual([
			"x.ts#useG",
		]);
	});
});
