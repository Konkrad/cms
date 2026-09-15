import { describe, expect, it } from "vitest";
import {
	THEME_PREFIX,
	themeAwareChunkName,
} from "../../scripts/theme-swap/chunk-naming";

describe("themeAwareChunkName", () => {
	it("names a theme module deterministically, stripping Qwik's segment hash", () => {
		const id =
			"/app/theme/routes/events/CheckoutView.tsx_CheckoutView_component_div_button_q_e_click_05p7b9X0J0c.js";
		expect(themeAwareChunkName(id)).toBe(
			`${THEME_PREFIX}routes_events_CheckoutView.tsx_CheckoutView_component_div_button_q_e_click.js`,
		);
	});

	it("produces the same name for two builds of identical theme source (no hash drift)", () => {
		// Same source, two different content hashes — as Rolldown would assign
		// across two separate builds of unchanged source.
		const buildA =
			"/app/theme/shared/ContentCard/ContentCard.tsx_ContentCard_component_AAAAAAAAAAA.js";
		const buildB =
			"/app/theme/shared/ContentCard/ContentCard.tsx_ContentCard_component_ZZZZZZZZZZZ.js";
		expect(themeAwareChunkName(buildA)).toBe(themeAwareChunkName(buildB));
	});

	it("returns null for a core (non-theme) module, leaving default bundling untouched", () => {
		const id = "/app/src/routes/layout.tsx_onRequest.js";
		expect(themeAwareChunkName(id)).toBeNull();
	});

	it("returns null for a node_modules module", () => {
		const id = "/app/node_modules/@qwik.dev/router/lib/index.qwik.mjs";
		expect(themeAwareChunkName(id)).toBeNull();
	});

	it("sanitizes characters that aren't safe in a filename", () => {
		const id = "/app/theme/blocks/Foo Bar/[slug].tsx_component.js";
		const name = themeAwareChunkName(id);
		expect(name).not.toBeNull();
		expect(name).toMatch(/^[a-zA-Z0-9_.-]+$/);
	});

	it("every theme-owned name is distinguishable from every core name by prefix", () => {
		const themeId = "/app/theme/chrome/Navigation/Navigation.tsx_component.js";
		const name = themeAwareChunkName(themeId);
		expect(name?.startsWith(THEME_PREFIX)).toBe(true);
	});
});
