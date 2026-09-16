/**
 * Custom `symbolMapper` for production SSR (see entry.ssr.tsx), used instead
 * of Qwik's default manifest-based resolver so a fork's overlaid theme
 * manifest fragment (see docs/theme-development.md, scripts/theme-swap/merge.ts)
 * actually takes effect without rebuilding the server bundle.
 *
 * Qwik's default resolver bakes `dist/q-manifest.json` into the compiled
 * server chunk at build time (`createPlatform` → `resolveManifest` →
 * `getClientManifest()`). Swapping theme chunks on disk after the fact does
 * nothing for symbol resolution unless something re-reads the manifest at
 * request time instead of trusting what got frozen into the bundle. This
 * reads `dist/q-manifest.json` fresh whenever its mtime changes, and is
 * otherwise a straight port of Qwik's own resolution logic (see
 * `createPlatform`/`resolveManifest` in `@qwik.dev/core/dist/server.mjs`) so
 * behavior matches the default for anyone not doing a theme swap.
 *
 * Production only — dev mode's SSR (`npm start`) resolves symbols through a
 * different, dev-specific path (`getDevSegmentPath`) that this must not
 * interfere with.
 */
import { readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import type { SymbolMapper, SymbolMapperFn } from "@qwik.dev/core/optimizer";

interface QManifestFragment {
	mapping: Record<string, string>;
}

// Qwik's own helper (packages/qwik/src/server/platform.ts) — the manifest's
// `mapping` is keyed by full symbol name (e.g. "s_05p7b9X0J0c"), but lookups
// arrive keyed by just the hash suffix.
function getSymbolHash(symbolName: string): string {
	const index = symbolName.lastIndexOf("_");
	return index > -1 ? symbolName.slice(index + 1) : symbolName;
}

const SYNC_QRL = "<sync>";

let cachedMapper: SymbolMapper | undefined;
let cachedMtimeMs = -1;

function loadMapper(): SymbolMapper | undefined {
	const manifestPath = join(process.cwd(), "dist", "q-manifest.json");
	let mtimeMs: number;
	try {
		mtimeMs = statSync(manifestPath).mtimeMs;
	} catch {
		// No client manifest on disk (shouldn't happen in a real production
		// deployment — dist/ ships alongside server/) — fall back to whatever
		// was last loaded, or undefined on the very first call.
		return cachedMapper;
	}
	if (mtimeMs === cachedMtimeMs && cachedMapper) {
		return cachedMapper;
	}

	const manifest: QManifestFragment = JSON.parse(
		readFileSync(manifestPath, "utf-8"),
	);
	const mapper: SymbolMapper = {};
	for (const symbol in manifest.mapping) {
		mapper[getSymbolHash(symbol)] = [symbol, manifest.mapping[symbol]];
	}
	cachedMapper = mapper;
	cachedMtimeMs = mtimeMs;
	return mapper;
}

export const themeAwareSymbolMapper: SymbolMapperFn = (
	symbolName,
	_mapper,
	parent,
) => {
	// Qwik wraps captured-closure QRLs in a synthetic internal QRL (e.g.
	// "_run", chunk: null — see `getQrlString` in @qwik.dev/core/dist/core.mjs)
	// that's never compiled to a real chunk. The framework's own default
	// mapper only special-cases these when `parent` is falsy; replicate the
	// special case unconditionally so it doesn't depend on that framework
	// internal (an earlier, since-reverted version of this build config did
	// hit a case where `parent` was truthy here — see git history).
	if (symbolName.startsWith("_") && symbolName.length < 6) {
		return [symbolName, `${import.meta.env?.BASE_URL ?? "/"}@qwik-handlers`];
	}

	const hash = getSymbolHash(symbolName);
	if (hash === SYNC_QRL) {
		return [hash, ""];
	}

	const mapper = loadMapper();
	const result = mapper?.[hash];
	if (result) {
		return result;
	}

	// eslint-disable-next-line no-console
	console.error(
		"theme-manifest symbolMapper: cannot resolve symbol",
		symbolName,
		"parent:",
		parent,
	);
	return undefined;
};
