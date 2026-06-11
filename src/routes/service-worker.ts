/*
 * WHAT IS THIS FILE?
 *
 * The service-worker.ts file is used to have state of the art prefetching.
 * https://qwik.dev/qwikcity/prefetching/overview/
 *
 * Qwik uses a service worker to speed up your site and reduce latency, ie, not used in the traditional way of offline.
 * You can also use this file to add more functionality that runs in the service worker.
 */
// `setupServiceWorker()` is deprecated in @qwik.dev/router — Qwik now embeds preload
// logic automatically, and the export is broken in the current beta. Per the framework
// guidance we drop the call and keep only the lifecycle handlers below.

addEventListener("install", () => self.skipWaiting());

addEventListener("activate", () => self.clients.claim());

declare const self: ServiceWorkerGlobalScope;
