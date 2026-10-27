import { type Component, component$ } from "@qwik.dev/core";
import type { SlotName, SlotProps } from "~/contracts/slots";
import { activeSlotComponents } from "./slots";

type ModuleSlotProps = {
	[Name in SlotName]: { name: Name; props: SlotProps[Name] };
}[SlotName];

/**
 * Renders the active modules' components for one slot (spec 4.1), in module order, each with the
 * slot's props. Nothing when no active module contributes. Core screens place it where the slot
 * goes, or project it into a theme view's named `<Slot>` with `q:slot`.
 */
export const ModuleSlot = component$<ModuleSlotProps>(({ name, props }) => {
	// Each contribution takes this slot's props (typed per slot in `~/contracts/slots`).
	const components = activeSlotComponents(name) as unknown as Component<
		Record<string, unknown>
	>[];
	return (
		<>
			{components.map((Contribution, i) => (
				<Contribution
					key={`${name}-${i}`}
					{...(props as Record<string, unknown>)}
				/>
			))}
		</>
	);
});
