import type { RequestEvent } from "@qwik.dev/router";
import {
	assertNoPrivateFields,
	getSiteInfo,
	getSocialWebSettings,
	requireActiveModule,
} from "~/core";
import { type ActorInfo, AS_CONTEXT, actorDocument } from "./activitystreams";
import { activityContentType, sendJsonDocument } from "./http";
import { imageMediaType } from "./items";
import { absoluteUrl, MODULE_ID, siteBase, socialUrls } from "./urls";

/** The actor's data from the deployment settings (`SOCIAL_WEB_*`) and the site. */
export function actorInfo(): ActorInfo {
	const settings = getSocialWebSettings();
	const iconUrl = absoluteUrl(settings.icon);
	return {
		account: settings.account,
		name: getSiteInfo().name,
		summary: settings.summary,
		siteUrl: `${siteBase()}/`,
		iconUrl,
		iconType: imageMediaType(iconUrl),
		updateInterval: settings.updateInterval,
	};
}

/** The host of `acct:` addresses: the site's (with its port, if any). */
export const accountHost = (): string => new URL(siteBase()).host;

/**
 * Whether a WebFinger `resource` names the site-wide account: `acct:news@host` (the `acct:`
 * prefix optional, case-insensitive) or the actor's IRI.
 */
export function isOwnResource(resource: string): boolean {
	const value = resource.trim();
	if (value === socialUrls().actor) return true;
	const address = value.replace(/^acct:/i, "").replace(/^@/, "");
	const at = address.lastIndexOf("@");
	if (at < 1) return false;
	return (
		address.slice(0, at).toLowerCase() ===
			getSocialWebSettings().account.toLowerCase() &&
		address.slice(at + 1).toLowerCase() === accountHost().toLowerCase()
	);
}

/**
 * `GET /.well-known/webfinger?resource=acct:news@host` (served from `/api/well-known/webfinger`,
 * see `rewriteWellKnown`): the JRD pointing to the actor. 400 without a resource, 404 for any
 * other account. Public on purpose.
 */
export async function handleWebfingerGet(event: RequestEvent): Promise<void> {
	requireActiveModule(event, MODULE_ID);
	const resource = event.url.searchParams.get("resource");
	if (!resource) throw event.error(400, "Missing resource");
	if (!isOwnResource(resource)) throw event.error(404, "Unknown resource");
	const urls = socialUrls();
	const subject = `acct:${getSocialWebSettings().account}@${accountHost()}`;
	await sendJsonDocument(
		event,
		assertNoPrivateFields({
			subject,
			aliases: [urls.actor],
			links: [
				{ rel: "self", type: "application/activity+json", href: urls.actor },
				{
					rel: "http://webfinger.net/rel/profile-page",
					type: "text/html",
					href: `${siteBase()}/`,
				},
			],
		}),
		{ contentType: "application/jrd+json; charset=utf-8" },
	);
}

/** `GET /social/actor`: the ActivityPoll actor (FEP-b06c). Public on purpose. */
export async function handleActorGet(event: RequestEvent): Promise<void> {
	requireActiveModule(event, MODULE_ID);
	await sendJsonDocument(
		event,
		assertNoPrivateFields(actorDocument(actorInfo())),
		{
			contentType: activityContentType(event.request.headers.get("accept")),
		},
	);
}

/**
 * Every method of `/social/inbox`. A poll-only actor receives nothing (FEP-b06c): GET shows an
 * empty collection, every write answers 405 (no body is read, nothing is stored). Writes reach
 * this handler past Qwik's CSRF check through `relabelInboxWrite`.
 */
export async function handleInboxRequest(event: RequestEvent): Promise<void> {
	requireActiveModule(event, MODULE_ID);
	event.headers.set("Allow", "GET, HEAD");
	if (event.method !== "GET" && event.method !== "HEAD") {
		event.headers.set("Content-Type", "text/plain; charset=utf-8");
		event.send(405, "This actor is poll-only: its inbox accepts nothing.");
		return;
	}
	const urls = socialUrls();
	await sendJsonDocument(
		event,
		{
			"@context": AS_CONTEXT,
			id: urls.inbox,
			type: "OrderedCollection",
			attributedTo: urls.actor,
			totalItems: 0,
			orderedItems: [],
		},
		{ contentType: activityContentType(event.request.headers.get("accept")) },
	);
}
