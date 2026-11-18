import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import { LOCALES } from "~/core/i18n/locales";
import { PLURAL_CATEGORIES } from "~/core/i18n/translate";
import { catalogSources } from "~/core/registry/i18n";

// Message catalogs (spec 4.8): core (`core.*`, `admin.*`), the theme (`theme.*`) and every
// module (`<id>.*`) ship `en.json` and one file per other locale. Decision: a non-English
// catalog must have exactly the English keys (a missing key FAILS here rather than only
// falling back at runtime), so `de` stays complete; English is still the runtime fallback.
const root = join(__dirname, "..", "..");

type Catalog = { file: string; locale: string; namespaces: string[] };

function moduleIds(): string[] {
	const dir = join(root, "src/modules");
	return readdirSync(dir).filter((id) =>
		existsSync(join(dir, id, "i18n", "en.json")),
	);
}

function catalogDirs(): { dir: string; namespaces: string[] }[] {
	return [
		{ dir: "src/core/i18n", namespaces: ["core", "admin"] },
		{ dir: "theme/i18n", namespaces: ["theme"] },
		...moduleIds().map((id) => ({
			dir: `src/modules/${id}/i18n`,
			namespaces: [id],
		})),
	];
}

function catalogs(): Catalog[] {
	return catalogDirs().flatMap(({ dir, namespaces }) =>
		readdirSync(join(root, dir))
			.filter((f) => f.endsWith(".json"))
			.map((f) => ({
				file: `${dir}/${f}`,
				locale: f.replace(/\.json$/, ""),
				namespaces,
			})),
	);
}

const read = (file: string): Record<string, string> =>
	JSON.parse(readFileSync(join(root, file), "utf8"));

const placeholders = (message: string) =>
	new Set([...message.matchAll(/\{(\w+)\}/g)].map((m) => m[1]));

/** Plural keys (`x_one`, `x_other`) also answer to their base `x`. */
const PLURAL_SUFFIX = new RegExp(`_(${PLURAL_CATEGORIES.join("|")})$`);

describe("message catalogs", () => {
	it("are valid JSON objects of strings, in a shipped locale, without duplicate keys", () => {
		for (const { file, locale } of catalogs()) {
			expect(LOCALES as readonly string[], file).toContain(locale);
			const raw = readFileSync(join(root, file), "utf8");
			const parsed = JSON.parse(raw);
			expect(typeof parsed, file).toBe("object");
			expect(Array.isArray(parsed), file).toBe(false);
			for (const [key, value] of Object.entries(parsed)) {
				expect(typeof value, `${file}: ${key}`).toBe("string");
			}
			// JSON.parse keeps the last of duplicate keys silently: count them in the text.
			const keys = [...raw.matchAll(/^\s*"((?:[^"\\]|\\.)*)"\s*:/gm)].map(
				(m) => m[1],
			);
			const duplicates = keys.filter((k, i) => keys.indexOf(k) !== i);
			expect(duplicates, file).toEqual([]);
			expect(keys.length, file).toBe(Object.keys(parsed).length);
		}
	});

	it("use only their own namespace", () => {
		for (const { file, namespaces } of catalogs()) {
			const foreign = Object.keys(read(file)).filter(
				(key) => !namespaces.some((ns) => key.startsWith(`${ns}.`)),
			);
			expect(foreign, file).toEqual([]);
		}
	});

	it("translate every English key and nothing else, with the same placeholders", () => {
		for (const { dir } of catalogDirs()) {
			const en = read(`${dir}/en.json`);
			for (const locale of LOCALES.filter((l) => l !== "en")) {
				const file = `${dir}/${locale}.json`;
				expect(existsSync(join(root, file)), file).toBe(true);
				const messages = read(file);
				const missing = Object.keys(en).filter((k) => !(k in messages));
				const unknown = Object.keys(messages).filter((k) => !(k in en));
				expect(missing, `${file} lacks keys`).toEqual([]);
				expect(unknown, `${file} has keys English lacks`).toEqual([]);
				for (const [key, message] of Object.entries(messages)) {
					const allowed = placeholders(en[key] ?? "");
					// a plural form may drop {count} ("one ticket")
					const stray = [...placeholders(message)].filter(
						(p) => !allowed.has(p),
					);
					expect(stray, `${file}: ${key}`).toEqual([]);
				}
			}
		}
	});

	it("complete every plural with an _other form", () => {
		for (const { file } of catalogs()) {
			const messages = read(file);
			for (const key of Object.keys(messages)) {
				const match = key.match(PLURAL_SUFFIX);
				if (match && match[1] !== "other") {
					expect(
						messages[key.replace(PLURAL_SUFFIX, "_other")],
						`${file}: ${key}`,
					).toBeDefined();
				}
			}
		}
	});

	it("are all registered in src/core/registry/i18n.ts", () => {
		expect(Object.keys(catalogSources.modules).sort()).toEqual(
			moduleIds().sort(),
		);
	});
});

function sourceFiles(dir: string): string[] {
	const out: string[] = [];
	for (const name of readdirSync(join(root, dir))) {
		const path = join(dir, name);
		if (statSync(join(root, path)).isDirectory())
			out.push(...sourceFiles(path));
		else if (/\.tsx?$/.test(name) && !/\.spec\.tsx?$/.test(name))
			out.push(path);
	}
	return out;
}

/** `t("key"` calls; a `t(` with anything but a string literal is reported as dynamic. */
const T_CALL =
	/(?<![\w.$])t\(\s*(?:"([a-z][\w-]*(?:\.\w+)+)"|'([a-z][\w-]*(?:\.\w+)+)'|(`|[A-Za-z_$][\w$.]*[,)]))/g;

describe("keys used in code", () => {
	const english: Record<string, string> = Object.assign(
		{},
		...catalogDirs().map(({ dir }) => read(`${dir}/en.json`)),
	);
	const exists = (key: string) => key in english || `${key}_other` in english;

	const uses = ["src", "theme"]
		.flatMap(sourceFiles)
		.filter((f) => !f.startsWith("src/core/i18n/"))
		.flatMap((file) => {
			const text = readFileSync(join(root, file), "utf8");
			if (!/\bt\(/.test(text)) return [];
			return [...text.matchAll(T_CALL)].map((m) => ({
				file: relative(".", file),
				key: m[1] ?? m[2],
				dynamic: m[3],
			}));
		});

	it("exist in the English catalogs", () => {
		expect(uses.length).toBeGreaterThan(1000);
		const unknown = uses
			.filter((u) => u.key && !exists(u.key))
			.map((u) => `${u.file}: ${u.key}`);
		expect(unknown).toEqual([]);
	});

	it("are string literals (so this test and the type check see them)", () => {
		const dynamic = uses
			.filter((u) => u.dynamic !== undefined)
			.map((u) => `${u.file}: t(${u.dynamic}`);
		expect(dynamic).toEqual([]);
	});

	it("stay in their own namespace in the theme and in modules", () => {
		const foreign = uses.filter(({ file, key }) => {
			if (!key) return false;
			const module = file.match(/^src\/modules\/([^/]+)\//)?.[1];
			if (module) return !key.startsWith(`${module}.`);
			if (file.startsWith("theme/")) return !key.startsWith("theme.");
			return !/^(core|admin)\./.test(key);
		});
		expect(foreign.map((u) => `${u.file}: ${u.key}`)).toEqual([]);
	});
});
