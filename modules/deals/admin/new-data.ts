import type { RequestEventLoader } from "@qwik.dev/router";
import { requireDealsAdmin } from "./auth";

/** Server-only: guard for the "new deal" route loader. */
export async function loadAdminDealNew(event: RequestEventLoader) {
	await requireDealsAdmin(event);
	return {};
}
