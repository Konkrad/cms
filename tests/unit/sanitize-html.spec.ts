import { describe, expect, it } from "vitest";
import { sanitizeRichHtml } from "~/core/content/sanitize-html";

describe("sanitizeRichHtml", () => {
	it("removes <script> tags", () => {
		const out = sanitizeRichHtml("<p>hi</p><script>alert(1)</script>");
		expect(out).toBe("<p>hi</p>");
		expect(out).not.toContain("script");
	});

	it("strips event-handler attributes", () => {
		const out = sanitizeRichHtml('<p onclick="steal()">x</p>');
		expect(out).not.toContain("onclick");
		expect(out).toContain("<p>x</p>");
	});

	it("neutralizes javascript: and data: URLs in links", () => {
		expect(
			sanitizeRichHtml('<a href="javascript:alert(1)">x</a>'),
		).not.toContain("javascript:");
		expect(
			sanitizeRichHtml('<a href="data:text/html,<script>">x</a>'),
		).not.toContain("data:");
	});

	it("drops the img onerror XSS vector entirely", () => {
		const out = sanitizeRichHtml('<img src=x onerror="alert(1)">');
		expect(out).not.toContain("onerror");
		expect(out).not.toContain("<img");
	});

	it("preserves allowed BlockNote formatting", () => {
		const html =
			"<h2>Title</h2><p><strong>bold</strong> and <em>italic</em></p><ul><li>one</li></ul>";
		expect(sanitizeRichHtml(html)).toBe(html);
	});

	it("keeps safe links and forces safe rel/target", () => {
		const out = sanitizeRichHtml('<a href="https://example.com">link</a>');
		expect(out).toContain('href="https://example.com"');
		expect(out).toContain('rel="noopener noreferrer nofollow"');
		expect(out).toContain('target="_blank"');
	});

	it("keeps tel: links", () => {
		expect(sanitizeRichHtml('<a href="tel:+4930123">call</a>')).toContain(
			'href="tel:+4930123"',
		);
	});

	it("keeps ref: links in the tab, without target or rel", () => {
		const out = sanitizeRichHtml(
			'<p><a href="ref:events:event:abc-123" target="_blank" onclick="x()">BBQ</a></p>',
		);
		expect(out).toBe('<p><a href="ref:events:event:abc-123">BBQ</a></p>');
		expect(
			sanitizeRichHtml('<a href="ref:scope:abc/events">here</a>'),
		).toContain('href="ref:scope:abc/events"');
	});

	it("drops links it cannot keep track of, keeping the text", () => {
		for (const href of [
			"javascript:alert(1)",
			"/germany/berlin/events/bbq",
			"events/bbq",
			"//evil.example/x",
			"ref:not a ref",
			"data:text/html,x",
			"",
		]) {
			const out = sanitizeRichHtml(`<p>see <a href="${href}">this</a></p>`);
			expect(out).toBe("<p>see <span>this</span></p>");
		}
		expect(sanitizeRichHtml("<p><a>no href</a></p>")).toBe(
			"<p><span>no href</span></p>",
		);
	});
});
