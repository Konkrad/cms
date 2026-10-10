import type { RequestEventLoader } from "@qwik.dev/router";
import { requireAdminEvent } from "./auth";

/** Server-only: import from route loaders only, never from components. */
export async function loadAdminScan(event: RequestEventLoader) {
	const { event: target } = await requireAdminEvent(event);
	return { id: target.id, title: target.title };
}

export type AdminScanData = Awaited<ReturnType<typeof loadAdminScan>>;
