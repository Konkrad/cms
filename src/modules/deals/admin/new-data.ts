import type { RequestEventLoader } from "@qwik.dev/router";
import { allowedVisibilities, requireModuleAdmin } from "~/core";

/** Server-only: guard for the "new deal" route loader. */
export async function loadAdminDealNew(event: RequestEventLoader) {
	const { user, scope, adminBase } = await requireModuleAdmin(event, {
		module: "deals",
	});
	return {
		adminBase,
		visibilities: await allowedVisibilities(user, scope.id),
	};
}

export type AdminDealNewData = Awaited<ReturnType<typeof loadAdminDealNew>>;
