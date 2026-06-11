/*
 * WHAT IS THIS FILE?
 *
 * It's the entry point for the production Node server, built via
 * `adapters/node-server/vite.config.ts`. The build emits `server/entry.node-server.js`,
 * which is what the Docker image runs.
 *
 * The server listens on PORT (default 3000) and binds 0.0.0.0 so it is reachable from
 * the Kamal proxy. Origin/CSRF resolution uses the ORIGIN env var (set to APP_URL in
 * production) since the app runs behind a TLS-terminating reverse proxy.
 */
import {
  createQwikRouter,
  type PlatformNode,
} from "@qwik.dev/router/middleware/node";
import "dotenv/config";
import { createServer } from "node:http";
import render from "./entry.ssr";

declare global {
  interface QwikRouterPlatform extends PlatformNode {}
}

const { router, notFound, staticFile } = createQwikRouter({ render });

const PORT = Number(process.env.PORT ?? 3000);

const server = createServer((req, res) => {
  staticFile(req, res, () => {
    router(req, res, () => {
      notFound(req, res, () => {});
    });
  });
});

server.listen(PORT, "0.0.0.0", () => {
  // eslint-disable-next-line no-console
  console.log(`Server started: http://0.0.0.0:${PORT}/`);
});
