/**
 * This is the base config for vite.
 * When building, the adapter config is used which loads this file and extends it.
 */

import { fileURLToPath } from "node:url";
import { qwikVite } from "@qwik.dev/core/optimizer";
import { qwikRouter } from "@qwik.dev/router/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig, type UserConfig } from "vite";
import pkg from "./package.json";
import {
	THEME_PREFIX,
	themeAwareChunkName,
} from "./scripts/theme-swap/chunk-naming";

// Absolute path to ./src for the "~" alias below.
const srcDir = fileURLToPath(new URL("./src/", import.meta.url));
// Absolute path to ./theme for the "~theme" alias below. The theme layer is a
// separately-licensed folder; the public site's presentational components live here.
const themeDir = fileURLToPath(new URL("./theme/", import.meta.url));
// Static assets served at the site root (favicon, manifest, robots.txt, fonts, logo)
// live under theme/static since they're theme/brand-owned — a fork replaces this
// whole directory to reskin the site's identity.
const publicDir = fileURLToPath(new URL("./theme/static/", import.meta.url));

type PkgDep = Record<string, string>;
const { dependencies = {}, devDependencies = {} } = pkg as any as {
	dependencies: PkgDep;
	devDependencies: PkgDep;
	[key: string]: unknown;
};
errorOnDuplicatesPkgDeps(devDependencies, dependencies);

/**
 * Note that Vite normally starts from `index.html` but the qwikCity plugin makes start at `src/entry.ssr.tsx` instead.
 */
export default defineConfig(
	async ({ command, isPreview }): Promise<UserConfig> => {
		// Dev server boot only (not `vite build`, not `vite preview`) — the production
		// server applies migrations itself in entry.node-server.tsx before it starts
		// listening. This runs once per dev-server start, not on every HMR reload,
		// since Vite doesn't re-invoke this config function for app-source changes.
		// Imported dynamically so `vite build` (which lacks the full secret set at
		// build time — see Dockerfile) never eagerly loads src/env.ts's validation.
		if (command === "serve" && !isPreview) {
			const { runMigrations } = await import("./src/db/migrate");
			runMigrations();
		}

		return {
			publicDir,
			plugins: [
				tailwindcss(),
				// strictLoaders defaults to true as of @qwik.dev/router beta.37, which makes every
				// routeAction$ send an empty loaderHashes list unless it explicitly opts specific
				// loaders in via `invalidate: [...]`. That silently disables the documented default
				// ("all current route loaders are invalidated after an action") for the whole app.
				qwikRouter({ trailingSlash: false, strictLoaders: false }),
				qwikVite(),
			],
			build: {
				// Use esbuild for CSS minification — stricter minifiers (lightningcss) reject
				// some third-party CSS shipped by deps (e.g. @blocknote/mantine's invalid
				// `@media (max-device-width: em(500px))`), which would fail the production build.
				cssMinify: "esbuild",
				rollupOptions: {
					output: {
						// Chunk names are derived from source path (see chunk-naming.ts) so a
						// fork's theme build produces filenames identical to this repo's —
						// required for scripts/theme-swap/{extract,merge}.ts to drop a fork's
						// theme output into this build without rebuilding it. See
						// docs/theme-development.md. Only theme/-owned modules are named
						// (everything else falls back to Rolldown's default bundling) — the
						// same function is reused by the SSR build in
						// adapters/node-server/vite.config.ts. The [name] placeholder is
						// filled from codeSplitting.groups below; no [hash] means no
						// per-build drift for theme chunks (non-theme chunks keep their
						// normal hashed names).
						chunkFileNames: (chunkInfo) =>
							chunkInfo.name?.startsWith(THEME_PREFIX)
								? "build/[name].js"
								: "build/[name]-[hash].js",
						codeSplitting: {
							groups: [{ name: themeAwareChunkName }],
						},
					},
				},
			},
			resolve: {
				// Explicit "~" -> ./src and "~theme" -> ./theme aliases. tsconfigPaths alone
				// does not resolve these in the production build for Qwik's optimizer-generated
				// segment modules, which breaks the Rollup build; an absolute alias resolves
				// everywhere (dev and build). "~theme/" must precede "~/" (the "~/" regex is
				// anchored on the slash so it won't match "~theme/", but order it first for clarity).
				alias: [
					{ find: /^~theme\//, replacement: themeDir },
					{ find: /^~\//, replacement: srcDir },
				],
				dedupe: ["react", "react-dom"],
			},
			// This tells Vite which dependencies to pre-build in dev mode.
			optimizeDeps: {
				// Put problematic deps that break bundling here, mostly those with binaries.
				// For example ['better-sqlite3'] if you use that in server functions.
				// Exclude native binary deps to prevent Vite from pre-bundling them in dev.
				exclude: ["better-sqlite3"],
				include: [
					"react",
					"react-dom",
					"react/jsx-runtime",
					"react-dom/client",
				],
			},

			/**
			 * This is an advanced setting. It improves the bundling of your server code. To use it, make sure you understand when your consumed packages are dependencies or dev dependencies. (otherwise things will break in production)
			 */
			ssr: {
				noExternal: ["date-fns"],
				external: ["@tryghost/koenig-lexical", "@lexical/react"],
			},

			server: {
				headers: {
					// Don't cache the server response in dev mode
					"Cache-Control": "public, max-age=0",
				},
			},
			preview: {
				headers: {
					// Do cache the server response in preview (non-adapter production build)
					"Cache-Control": "public, max-age=600",
				},
			},
		};
	},
);

// *** utils ***

/**
 * Function to identify duplicate dependencies and throw an error
 * @param {Object} devDependencies - List of development dependencies
 * @param {Object} dependencies - List of production dependencies
 */
function errorOnDuplicatesPkgDeps(
	devDependencies: PkgDep,
	dependencies: PkgDep,
) {
	let msg = "";
	// Create an array 'duplicateDeps' by filtering devDependencies.
	// If a dependency also exists in dependencies, it is considered a duplicate.
	const duplicateDeps = Object.keys(devDependencies).filter(
		(dep) => dependencies[dep],
	);

	// include any known qwik packages
	const qwikPkg = Object.keys(dependencies).filter((value) =>
		/qwik/i.test(value),
	);

	// any errors for missing "qwik-city-plan"
	// [PLUGIN_ERROR]: Invalid module "@qwik-router-config" is not a valid package
	msg = `Move qwik packages ${qwikPkg.join(", ")} to devDependencies`;

	if (qwikPkg.length > 0) {
		throw new Error(msg);
	}

	// Format the error message with the duplicates list.
	// The `join` function is used to represent the elements of the 'duplicateDeps' array as a comma-separated string.
	msg = `
    Warning: The dependency "${duplicateDeps.join(
			", ",
		)}" is listed in both "devDependencies" and "dependencies".
    Please move the duplicated dependencies to "devDependencies" only and remove it from "dependencies"
  `;

	// Throw an error with the constructed message.
	if (duplicateDeps.length > 0) {
		throw new Error(msg);
	}
}
