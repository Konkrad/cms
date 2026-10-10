import type { RequestEventLoader } from "@qwik.dev/router";
import { requireModuleAdmin } from "~/core-api";

/** Server-only: guard for the "new deal" route loader. */
export async function loadAdminDealNew(event: RequestEventLoader) {
	await requireModuleAdmin(event, { module: "deals", scope: "global" });
	return {};
}
