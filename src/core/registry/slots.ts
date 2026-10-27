/**
 * Client-safe slot registry (spec 4.1): each module's slot components (its `slots.tsx`, the same
 * object as the manifest's `slots`), so the browser can render them without the server-side
 * manifests. `unit/slots.spec.ts` checks it against the manifests.
 */
import type { SlotComponents, SlotName } from "~/contracts/slots";
import { slotContributionsOf } from "~/core/router/modules";
import config from "../../../modules.config";
import { electionsSlots } from "../../modules/elections/slots";
import { eventsSlots } from "../../modules/events/slots";

/** Module id → its slot components. Add a line per module that contributes to a slot. */
export const moduleSlots: Record<string, SlotComponents> = {
	elections: electionsSlots,
	events: eventsSlots,
};

/** The active modules' components for one slot, in module order. */
export const activeSlotComponents = <Name extends SlotName>(name: Name) =>
	slotContributionsOf(moduleSlots, name, config.active);
