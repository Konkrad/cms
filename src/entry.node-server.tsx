/*
 * WHAT IS THIS FILE?
 *
 * It's the entry point for the production Node server, built via
 * `adapters/node-server/vite.config.ts`. The build emits `server/entry.node-server.js`,
 * which is what the Docker image runs.
 *
 * The server listens on PORT (default 3000) and binds 0.0.0.0 so it is reachable from
 * whatever reverse proxy fronts it. The server's origin (Qwik's CSRF check compares every
 * write's Origin header with it) is APP_URL's: behind a TLS-terminating proxy the socket alone
 * would say http.
 */
import {
	createQwikRouter,
	type PlatformNode,
} from "@qwik.dev/router/middleware/node";
import "dotenv/config";
import { createServer } from "node:http";
import { runMigrations } from "./core/db/migrate";
import { assertBuiltSiteLocale } from "./core/i18n/server";
import { startOutboxWorker } from "./core/notifications/worker";
import { assertBuiltModules } from "./core/registry/assert-built-modules";
import { prepareRawRequest } from "./core/registry/raw-request";
import { startScheduler } from "./core/scheduler/worker";
import render from "./entry.ssr";
import { env } from "./env";

declare global {
	interface QwikRouterPlatform extends PlatformNode {}
}

assertBuiltSiteLocale();
assertBuiltModules();
runMigrations();
// Sends queued notifications (src/core/notifications) from this process, after migrations.
startOutboxWorker();
// Runs the schedules of core and the active modules (and retried review handlers).
startScheduler();

const origin = new URL(env.APP_URL).origin;
const { router, notFound, staticFile } = createQwikRouter({ render, origin });

const server = createServer((req, res) => {
	prepareRawRequest(req, origin);
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
