import type { RequestEventCommon } from "@qwik.dev/router";
import { requireModuleAdmin } from "~/core-api";
import { eventsService } from "../services/events";

/**
 * The events admin guard (`requireModuleAdmin`, any scope: global admin or a group's representatives) plus the per-event scope check for routes under `events/[id]`: the event
 * must exist and, outside the global scope, belong to the group of the `[group_slug]` in the URL.
 * A representative of group A therefore can neither read nor change group B's events by id, and
 * an event of A is not reachable under B's slug either.
 *
 * A missing event 404s, or redirects to the events list with `onMissing: "redirect"`.
 */
export async function requireAdminEvent(
	event: RequestEventCommon,
	opts: { onMissing?: "404" | "redirect" } = {},
) {
	return requireAdminEventById(event, event.params.id, opts);
}

/** Like `requireAdminEvent` for actions that take the event id from the request body. */
export async function requireAdminEventById(
	event: RequestEventCommon,
	eventId: string,
	opts: { onMissing?: "404" | "redirect" } = {},
) {
	const ctx = await requireModuleAdmin(event, {
		module: "events",
		scope: "any",
	});
	const target = await eventsService.getById(eventId);
	if (!target) {
		if (opts.onMissing === "redirect") {
			throw event.redirect(303, `/admin/${event.params.group_slug}/events`);
		}
		throw event.error(404, "Event not found");
	}
	if (!ctx.isGlobal && target.groupId !== ctx.group.id) {
		throw event.error(403, "Forbidden");
	}
	return { ...ctx, event: target };
}

/**
 * Complimentary tickets create user accounts and free tickets, so they stay limited to platform
 * admins (the global scope), as before the module port. Also checks the event is in scope.
 */
export async function requireCompTicketsAdmin(event: RequestEventCommon) {
	const ctx = await requireAdminEvent(event, { onMissing: "redirect" });
	if (!ctx.isGlobal) throw event.error(403, "Forbidden");
	return ctx;
}
