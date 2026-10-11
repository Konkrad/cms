import type { RequestEventLoader } from "@qwik.dev/router";
import { publicImageUrlFromKey } from "~/core";
import { requireAdminEvent } from "./event-guards";

/**
 * Server-only: import from route loaders only, never from components.
 * The event in the admin's scope (404 when missing), without its organizer's user row and email.
 */
export async function loadAdminEventEdit(event: RequestEventLoader) {
	const { event: target } = await requireAdminEvent(event);
	const { user: _organizer, ...data } = target;
	return {
		...data,
		image1Url: publicImageUrlFromKey(data.image1),
		image2Url: publicImageUrlFromKey(data.image2),
	};
}

export type AdminEventEditData = Awaited<ReturnType<typeof loadAdminEventEdit>>;
