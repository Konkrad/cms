import { describe, expect, it } from "vitest";
import { jsonLdScript } from "~/core/seo";

describe("jsonLdScript", () => {
	it("is a typed JSON-LD script whose JSON parses back", () => {
		const data = { "@type": "Article", headline: "Spring" };
		const s = jsonLdScript(data);
		expect(s.type).toBe("application/ld+json");
		expect(JSON.parse(s.script)).toEqual(data);
	});

	it("escapes < so user text cannot close the script element", () => {
		const s = jsonLdScript({ headline: "</script><script>alert(1)</script>" });
		expect(s.script).not.toContain("<");
		expect(JSON.parse(s.script).headline).toBe(
			"</script><script>alert(1)</script>",
		);
	});
});
