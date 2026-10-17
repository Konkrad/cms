import type { IncomingMessage } from "node:http";
import { describe, expect, it } from "vitest";
import { prepareRawRequest } from "~/core/registry/raw-request";

const req = (
	method: string,
	url: string,
	headers: Record<string, string> = {},
	originalUrl?: string,
) =>
	({ method, url, headers: { ...headers }, originalUrl }) as IncomingMessage & {
		originalUrl?: string;
	};

describe("prepareRawRequest", () => {
	it("routes /.well-known/* to /api/well-known/* (Qwik never routes /.well-known)", () => {
		const r = req("GET", "/.well-known/webfinger?resource=acct%3Anews%40x");
		prepareRawRequest(r);
		expect(r.url).toBe("/api/well-known/webfinger?resource=acct%3Anews%40x");
		// The dev server (connect) keeps the first URL in originalUrl, which Qwik prefers.
		const dev = req(
			"GET",
			"/.well-known/webfinger",
			{},
			"/.well-known/webfinger",
		);
		prepareRawRequest(dev);
		expect(dev.originalUrl).toBe("/api/well-known/webfinger");
		const other = req("GET", "/well-known/x");
		prepareRawRequest(other);
		expect(other.url).toBe("/well-known/x");
	});

	it("lets every write to the poll-only inbox reach its 405 past the CSRF check", () => {
		for (const method of ["POST", "PUT", "DELETE"]) {
			const r = req(method, "/social/inbox/", {
				"content-type": "application/x-www-form-urlencoded",
			});
			prepareRawRequest(r);
			expect(r.headers["content-type"]).toBe("application/x-poll-only-inbox");
		}
		const read = req("GET", "/social/inbox");
		prepareRawRequest(read);
		expect(read.headers["content-type"]).toBeUndefined();
		const elsewhere = req("POST", "/social/outbox", {
			"content-type": "text/plain",
		});
		prepareRawRequest(elsewhere);
		expect(elsewhere.headers["content-type"]).toBe("text/plain");
	});

	it("still relabels the one-click unsubscribe POST", () => {
		const r = req("POST", "/api/notifications/unsubscribe?token=x", {
			"content-type": "application/x-www-form-urlencoded",
		});
		prepareRawRequest(r);
		expect(r.headers["content-type"]).toBe(
			"application/x-one-click-unsubscribe",
		);
	});
});
