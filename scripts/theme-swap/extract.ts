/**
 * Pulls every theme-owned artifact out of a completed production build
 * (`npm run build.client && npm run build.server`) into a standalone
 * directory that a base image's Dockerfile can later overlay via merge.ts.
 * See docs/theme-development.md ("Drop-in theme overlay").
 *
 * Theme ownership is determined the same way merge.ts and vite.config.ts
 * determine it: chunk names prefixed with THEME_PREFIX (chunk-naming.ts).
 *
 * Usage: tsx scripts/theme-swap/extract.ts [--dist=dist] [--server=server] [--out=theme-artifact]
 */
import {
	cpSync,
	existsSync,
	mkdirSync,
	readdirSync,
	readFileSync,
	writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { THEME_PREFIX } from "./chunk-naming";

interface Args {
	dist: string;
	server: string;
	out: string;
}

function parseArgs(): Args {
	const args: Args = { dist: "dist", server: "server", out: "theme-artifact" };
	for (const arg of process.argv.slice(2)) {
		const match = arg.match(/^--(dist|server|out)=(.+)$/);
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
	// href is site-root-relative (e.g. "/assets/BP91H-75-style.css").
	return join(distDir, href.replace(/^\//, ""));
}

function main() {
	const { dist, server, out } = parseArgs();

	const manifestPath = join(dist, "q-manifest.json");
	if (!existsSync(manifestPath)) {
		throw new Error(
			`${manifestPath} not found — run "npm run build.client" first.`,
		);
	}
	const serverThemeDir = join(server, "theme");
	if (!existsSync(serverThemeDir)) {
		throw new Error(
			`${serverThemeDir} not found — run "npm run build.server" first.`,
		);
	}

	mkdirSync(join(out, "build"), { recursive: true });
	mkdirSync(join(out, "server", "theme"), { recursive: true });

	// 1. Client chunks: everything Rolldown named with the theme prefix.
	const clientBuildDir = join(dist, "build");
	const themeChunks = readdirSync(clientBuildDir).filter((name) =>
		name.startsWith(THEME_PREFIX),
	);
	for (const name of themeChunks) {
		cpSync(join(clientBuildDir, name), join(out, "build", name));
	}

	// 2. Server chunks: same naming scheme as the client (chunk-naming.ts's
	// themeAwareChunkName is shared by both builds), so theme ownership is
	// determined the same way — by filename prefix, not directory structure.
	const serverThemeChunks = readdirSync(serverThemeDir).filter((name) =>
		name.startsWith(THEME_PREFIX),
	);
	for (const name of serverThemeChunks) {
		cpSync(join(serverThemeDir, name), join(out, "server", "theme", name));
	}

	// 3. Manifest fragment: only the bundles/mapping/symbols entries that
	// belong to theme chunks, keyed the same way as the full manifest so
	// merge.ts can splice them in directly.
	const manifest: QManifest = JSON.parse(readFileSync(manifestPath, "utf-8"));
	const bundles: Record<string, unknown> = {};
	for (const [key, value] of Object.entries(manifest.bundles)) {
		if (key.startsWith(THEME_PREFIX)) bundles[key] = value;
	}
	const mapping: Record<string, string> = {};
	const themeSymbolKeys = new Set<string>();
	for (const [key, value] of Object.entries(manifest.mapping)) {
		if (value.startsWith(THEME_PREFIX)) {
			mapping[key] = value;
			themeSymbolKeys.add(key);
		}
	}
	const symbols: Record<string, unknown> = {};
	for (const [key, value] of Object.entries(manifest.symbols)) {
		if (themeSymbolKeys.has(key)) symbols[key] = value;
	}
	writeFileSync(
		join(out, "manifest-fragment.json"),
		JSON.stringify({ bundles, mapping, symbols }, null, 2),
	);

	// 4. Global stylesheet. Tailwind emits one atomic CSS file covering the
	// whole app (core + theme utility classes together) — there's no
	// per-module boundary to split the way JS chunks have. merge.ts instead
	// overwrites the base build's stylesheet with this one wholesale, in
	// place, keeping the base's original (hashed) filename so nothing that
	// references it needs to change. This is only correct when the fork was
	// built from the same core source as the base image (see docs) — see the
	// "known limitations" note in docs/theme-development.md.
	const stylesheetPath = findStylesheetPath(dist, manifest);
	if (!stylesheetPath || !existsSync(stylesheetPath)) {
		throw new Error(
			"Could not locate the build's stylesheet via q-manifest.json's injections.",
		);
	}
	cpSync(stylesheetPath, join(out, "style.css"));

	const coreLeftover =
		Object.keys(manifest.mapping).length - Object.keys(mapping).length;
	console.log(`Extracted theme artifact to ${out}/`);
	console.log(`  client chunks: ${themeChunks.length}`);
	console.log(`  server chunks: ${serverThemeChunks.length}`);
	console.log(
		`  manifest symbols: ${Object.keys(symbols).length} (of ${Object.keys(manifest.symbols).length} total, ${coreLeftover} core-owned)`,
	);
	console.log(`  stylesheet: ${stylesheetPath} -> ${out}/style.css`);
}

main();
