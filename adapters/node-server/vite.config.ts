import { nodeServerAdapter } from "@qwik.dev/router/adapters/node-server/vite";
import { extendConfig } from "@qwik.dev/router/vite";
import {
	THEME_PREFIX,
	themeAwareChunkName,
} from "../../scripts/theme-swap/chunk-naming";
import baseConfig from "../../vite.config";

export default extendConfig(baseConfig, () => {
	return {
		build: {
			ssr: true,
			rollupOptions: {
				input: ["src/entry.node-server.tsx", "@qwik-router-config"],
				output: {
					// SSR doesn't need lazy-loaded chunks the way client code does, so
					// Rolldown concatenates a module into its only importer by default
					// (e.g. a theme component only ever rendered from one route gets
					// inlined into that route's chunk) — and *which* modules get
					// concatenated together isn't stable across builds. That defeats
					// per-module chunk naming for the theme boundary. Naming only
					// theme/-owned modules via codeSplitting.groups (rather than a
					// blanket `preserveModules: true`) pulls those specific modules
					// into their own deterministic chunk while leaving Rolldown's
					// default bundling of everything else — including framework code
					// like @qwik.dev/router's node middleware, which computes its
					// static-file root relative to import.meta.url and breaks if
					// pulled out of the chunk it's normally inlined into — untouched.
					// Required by scripts/theme-swap/{extract,merge}.ts — see
					// docs/theme-development.md.
					codeSplitting: {
						groups: [{ name: themeAwareChunkName }],
					},
					chunkFileNames: (chunkInfo) =>
						chunkInfo.name?.startsWith(THEME_PREFIX)
							? `theme/[name].js`
							: `_virtual/[name]-[hash].js`,
				},
			},
		},
		// ssg: null disables build-time static generation — this is a dynamic, auth-gated
		// app rendered on every request, so there are no pages to pre-render.
		plugins: [nodeServerAdapter({ name: "node-server", ssg: null })],
	};
});
