/**
 * Client-safe block gating. Module manifests import server code, so the browser cannot read
 * them; this file lists each module's block types from side-effect-free `blocks.ts` files
 * instead. `unit/modules.spec.ts` checks it against the manifests.
 */
import { disabledBlockTypes } from "~/core/modules";
import { dealsBlocks } from "../../../modules/deals/blocks";
import { eventsBlocks } from "../../../modules/events/blocks";
import config from "../../../modules.config";

/** Module id → block types it owns. Add a line per module that contributes blocks. */
export const moduleBlocks: Record<string, string[]> = {
	deals: dealsBlocks,
	events: eventsBlocks,
};

/** Block types of inactive modules: hidden from the admin picker and not rendered. */
export const disabledBlocks = disabledBlockTypes(moduleBlocks, config.active);
