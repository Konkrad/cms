import { describe, it, expect } from "vitest";
import { sanitizeRichHtml } from "~/utils/sanitize-html";

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
    expect(sanitizeRichHtml('<a href="javascript:alert(1)">x</a>')).not.toContain(
      "javascript:",
    );
    expect(sanitizeRichHtml('<a href="data:text/html,<script>">x</a>')).not.toContain(
      "data:",
    );
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
});
