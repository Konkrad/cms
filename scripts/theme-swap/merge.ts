/**
 * Overlays a theme artifact (produced by extract.ts, typically from a fork's
 * own build of the same core source) onto a base production build, in
 * place. This is what lets a downstream project ship a themed image without
 * rebuilding core. See docs/theme-development.md ("Drop-in theme overlay").
 *
 * Usage: tsx scripts/theme-swap/merge.ts [--theme=theme-artifact] [--dist=dist] [--server=server]
 */
import {
	cpSync,
	existsSync,
	readdirSync,
	readFileSync,
	unlinkSync,
	writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { THEME_PREFIX } from "./chunk-naming";

interface Args {
	theme: string;
	dist: string;
	server: string;
}

function parseArgs(): Args {
	const args: Args = {
		theme: "theme-artifact",
		dist: "dist",
		server: "server",
	};
	for (const arg of process.argv.slice(2)) {
		const match = arg.match(/^--(theme|dist|server)=(.+)$/);
		if (match) {
			args[match[1] as keyof Args] = match[2];
		}
	}
	return args;
}

interface QManifest {
	bundles: Record<string, unknown>;
	mapping: Record<string, string>;
	symbols: Record<string, unknown>;
	injections?: Array<{
		tag: string;
		attributes?: Record<string, string>;
	}>;
	[key: string]: unknown;
}

interface ManifestFragment {
	bundles: Record<string, unknown>;
	mapping: Record<string, string>;
	symbols: Record<string, unknown>;
}

function findStylesheetPath(
	distDir: string,
	manifest: QManifest,
): string | undefined {
	const link = manifest.injections?.find(
		(injection) =>
			injection.tag === "link" && injection.attributes?.rel === "stylesheet",
	);
	const href = link?.attributes?.href;
	if (!href) return undefined;
	return join(distDir, href.replace(/^\//, ""));
}

function main() {
	const { theme, dist, server } = parseArgs();

	for (const required of [
		join(theme, "manifest-fragment.json"),
		join(theme, "style.css"),
		join(theme, "build"),
		join(theme, "server", "theme"),
	]) {
		if (!existsSync(required)) {
			throw new Error(
				`${required} not found — run extract.ts against a themed build first.`,
			);
		}
	}

	const manifestPath = join(dist, "q-manifest.json");
	const manifest: QManifest = JSON.parse(readFileSync(manifestPath, "utf-8"));
	const fragment: ManifestFragment = JSON.parse(
		readFileSync(join(theme, "manifest-fragment.json"), "utf-8"),
	);

	// 1. Client chunks: drop the base's theme-* chunks and copy in the
	// fork's, rather than overwriting in place — the fork's theme may not
	// own the exact same set of chunks (e.g. a component that no longer
	// exists), and stale leftovers would keep shipping in the image.
	const clientBuildDir = join(dist, "build");
	for (const name of readdirSync(clientBuildDir)) {
		if (name.startsWith(THEME_PREFIX)) unlinkSync(join(clientBuildDir, name));
	}
	for (const name of readdirSync(join(theme, "build"))) {
		cpSync(join(theme, "build", name), join(clientBuildDir, name));
	}

	// 2. Server chunks: same replace-don't-overwrite treatment as the client
	// chunks above, and for the same reason.
	const serverThemeDir = join(server, "theme");
	for (const name of readdirSync(serverThemeDir)) {
		if (name.startsWith(THEME_PREFIX)) unlinkSync(join(serverThemeDir, name));
	}
	for (const name of readdirSync(join(theme, "server", "theme"))) {
		cpSync(join(theme, "server", "theme", name), join(serverThemeDir, name));
	}

	// 3. Manifest: strip the base's theme-owned entries, splice in the
	// fork's. Non-theme entries (core bundles, framework entry chunks) are
	// untouched — they come from core source, which is identical between
	// the base image and the fork by construction (see docs).
	for (const key of Object.keys(manifest.bundles)) {
		if (key.startsWith(THEME_PREFIX)) delete manifest.bundles[key];
	}
	Object.assign(manifest.bundles, fragment.bundles);

	const staleSymbolKeys = new Set(
		Object.entries(manifest.mapping)
			.filter(([, value]) => value.startsWith(THEME_PREFIX))
			.map(([key]) => key),
	);
	for (const key of staleSymbolKeys) {
		delete manifest.mapping[key];
		delete manifest.symbols[key];
	}
	Object.assign(manifest.mapping, fragment.mapping);
	Object.assign(manifest.symbols, fragment.symbols);

	writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

	// 4. Global stylesheet: overwritten in place under the base's own
	// (hashed) filename, so nothing that references it — the injections
	// entry just written above included — needs to change.
	const stylesheetPath = findStylesheetPath(dist, manifest);
	if (!stylesheetPath || !existsSync(stylesheetPath)) {
		throw new Error(
			"Could not locate the base build's stylesheet via q-manifest.json's injections.",
		);
	}
	cpSync(join(theme, "style.css"), stylesheetPath);

	console.log(
		`Merged theme artifact from ${theme}/ into ${dist}/ and ${server}/`,
	);
	console.log(
		`  client chunks replaced: ${readdirSync(join(theme, "build")).length}`,
	);
	console.log(
		`  server chunks replaced: ${readdirSync(join(theme, "server", "theme")).length}`,
	);
	console.log(
		`  manifest symbols replaced: ${Object.keys(fragment.symbols).length}`,
	);
	console.log(`  stylesheet: ${theme}/style.css -> ${stylesheetPath}`);
}

main();
