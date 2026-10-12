/*
 * WHAT IS THIS FILE?
 *
 * It's the entry point for the production Node server, built via
 * `adapters/node-server/vite.config.ts`. The build emits `server/entry.node-server.js`,
 * which is what the Docker image runs.
 *
 * The server listens on PORT (default 3000) and binds 0.0.0.0 so it is reachable from
 * whatever reverse proxy fronts it. Origin/CSRF resolution uses the ORIGIN env var (set
 * to APP_URL in production) since the app runs behind a TLS-terminating reverse proxy.
 */
import {
	createQwikRouter,
	type PlatformNode,
} from "@qwik.dev/router/middleware/node";
import "dotenv/config";
import { createServer } from "node:http";
import { runMigrations } from "./core/db/migrate";
import { allowOneClickUnsubscribe } from "./core/notifications/one-click";
import { startOutboxWorker } from "./core/notifications/worker";
import { startScheduler } from "./core/scheduler/worker";
import render from "./entry.ssr";
import { env } from "./env";

declare global {
	interface QwikRouterPlatform extends PlatformNode {}
}

runMigrations();
// Sends queued notifications (src/core/notifications) from this process, after migrations.
startOutboxWorker();
// Runs the schedules of core and the active modules (and retried review handlers).
startScheduler();

const { router, notFound, staticFile } = createQwikRouter({ render });

const server = createServer((req, res) => {
	allowOneClickUnsubscribe(req);
	staticFile(req, res, () => {
		router(req, res, () => {
			notFound(req, res, () => {});
		});
	});
});

server.listen(env.PORT, "0.0.0.0", () => {
	// eslint-disable-next-line no-console
	console.log(`Server started: http://0.0.0.0:${env.PORT}/`);
});
