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

const ORIGIN = "https://cms.example";

describe("prepareRawRequest", () => {
	it("routes /.well-known/* to /api/well-known/* (Qwik never routes /.well-known)", () => {
		const r = req("GET", "/.well-known/webfinger?resource=acct%3Anews%40x");
		prepareRawRequest(r, ORIGIN);
		expect(r.url).toBe("/api/well-known/webfinger?resource=acct%3Anews%40x");
		// The dev server (connect) keeps the first URL in originalUrl, which Qwik prefers.
		const dev = req(
			"GET",
			"/.well-known/webfinger",
			{},
			"/.well-known/webfinger",
		);
		prepareRawRequest(dev, ORIGIN);
		expect(dev.originalUrl).toBe("/api/well-known/webfinger");
		const other = req("GET", "/well-known/x");
		prepareRawRequest(other, ORIGIN);
		expect(other.url).toBe("/well-known/x");
	});

	it("lets every write to the poll-only inbox reach its 405 past the origin check", () => {
		for (const method of ["POST", "PUT", "DELETE"]) {
			const r = req(method, "/social/inbox/", {
				origin: "https://other.example",
			});
			prepareRawRequest(r, ORIGIN);
			expect(r.headers.origin).toBe(ORIGIN);
		}
		const read = req("GET", "/social/inbox");
		prepareRawRequest(read, ORIGIN);
		expect(read.headers.origin).toBeUndefined();
		const elsewhere = req("POST", "/social/outbox");
		prepareRawRequest(elsewhere, ORIGIN);
		expect(elsewhere.headers.origin).toBeUndefined();
	});

	it("lets the one-click unsubscribe POST pass, and nothing else on that path", () => {
		const r = req("POST", "/api/notifications/unsubscribe?token=x", {
			origin: "https://mail.example.net",
		});
		prepareRawRequest(r, ORIGIN);
		expect(r.headers.origin).toBe(ORIGIN);
		const put = req("PUT", "/api/notifications/unsubscribe?token=x");
		prepareRawRequest(put, ORIGIN);
		expect(put.headers.origin).toBeUndefined();
	});

	it("lets payment provider webhooks pass, only POST and one provider segment", () => {
		const r = req("POST", "/api/payments/webhook/stripe");
		prepareRawRequest(r, ORIGIN);
		expect(r.headers.origin).toBe(ORIGIN);
		for (const [method, url] of [
			["PUT", "/api/payments/webhook/stripe"],
			["POST", "/api/payments/webhook/stripe/extra"],
			["POST", "/api/payments/refund"],
			["POST", "/admin/root/payments"],
		]) {
			const other = req(method, url, { origin: "https://evil.example" });
			prepareRawRequest(other, ORIGIN);
			expect(other.headers.origin).toBe("https://evil.example");
		}
	});
});
