import { describe, expect, it, vi } from "vitest";
import { SLOT_NAMES } from "~/contracts/slots";
import { allModules } from "~/core/registry/manifests";
import { activeSlotComponents, moduleSlots } from "~/core/registry/slots";
import config from "../../modules.config";

// Slot components use `server$` and router components; the router runtime does not load in
// unit tests, so stub what the slot files touch at import time.
vi.mock("@qwik.dev/router", async () => {
	const { z } = await import("zod");
	const stub = (value: unknown) => value;
	return {
		server$: stub,
		serverQrl: stub,
		routeAction$: stub,
		routeActionQrl: stub,
		zod$: stub,
		zodQrl: stub,
		z,
		Form: () => null,
		Link: () => null,
	};
});

describe("slot registry", () => {
	it("has a component for exactly the slots each manifest declares", () => {
		const fromManifests = Object.fromEntries(
			allModules.flatMap((m) =>
				m.slots?.length ? [[m.id, [...m.slots].sort()]] : [],
			),
		);
		const fromRegistry = Object.fromEntries(
			Object.entries(moduleSlots).map(([id, slots]) => [
				id,
				Object.keys(slots).sort(),
			]),
		);
		expect(fromRegistry).toEqual(fromManifests);
	});

	it("uses only declared slot names", () => {
		for (const slots of Object.values(moduleSlots))
			for (const name of Object.keys(slots))
				expect(SLOT_NAMES as readonly string[]).toContain(name);
	});

	it("renders the contributions of active modules only", () => {
		for (const name of SLOT_NAMES) {
			const expected = config.active.flatMap((id) => {
				const component = moduleSlots[id]?.[name];
				return component ? [component] : [];
			});
			expect(activeSlotComponents(name)).toEqual(expected);
		}
		expect(activeSlotComponents("profile.sections")).toEqual([
			moduleSlots.elections["profile.sections"],
			moduleSlots.events["profile.sections"],
		]);
	});
});
