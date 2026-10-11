import type { RequestEventLoader } from "@qwik.dev/router";
import { requireModuleAdmin } from "~/core";

/** Server-only: guard for the "new deal" route loader. */
export async function loadAdminDealNew(event: RequestEventLoader) {
	const { adminBase } = await requireModuleAdmin(event, {
		module: "deals",
		scope: "any",
	});
	return { adminBase };
}

export type AdminDealNewData = Awaited<ReturnType<typeof loadAdminDealNew>>;
