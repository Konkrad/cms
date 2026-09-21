import { nodeServerAdapter } from "@qwik.dev/router/adapters/node-server/vite";
import { extendConfig } from "@qwik.dev/router/vite";
import baseConfig from "../../vite.config";

export default extendConfig(baseConfig, () => {
	return {
		build: {
			ssr: true,
			rollupOptions: {
				input: ["src/entry.node-server.tsx", "@qwik-router-config"],
			},
		},
		// ssg: null disables build-time static generation — this is a dynamic, auth-gated
		// app rendered on every request, so there are no pages to pre-render.
		plugins: [nodeServerAdapter({ name: "node-server", ssg: null })],
	};
});
