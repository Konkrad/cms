import type { RequestEvent } from "@qwik.dev/router";
import {
	assertNoPrivateFields,
	type PublicFeedEntry,
	publicFeed,
	requireActiveModule,
	type StreamType,
} from "~/core";
import {
	AS_CONTEXT,
	type AsDocument,
	createActivity,
	deleteActivity,
	toAsObject,
	toTombstone,
} from "./activitystreams";
import { activityContentType, sendCached, sendJsonDocument } from "./http";
import { toFeedItems } from "./items";
import { MODULE_ID, socialUrls } from "./urls";

/** Activities per outbox page. */
export const OUTBOX_PAGE_SIZE = 20;

/** The first page's `page` parameter; later pages carry the cursor of the previous one. */
export const FIRST_PAGE = "first";

/**
 * Outbox entries as activities, in order: a published item is a `Create` of its `Note` or
 * `Article`; once it left the public feeds the `Create` keeps its place with a `Tombstone` as
 * object and a `Delete` is added at the time it left (FEP-b06c).
 */
export async function toActivities(
	entries: readonly PublicFeedEntry[],
): Promise<AsDocument[]> {
	const live = await toFeedItems(entries.flatMap((e) => e.item ?? []));
	const objects = new Map(
		live.map((item) => [`${item.type}:${item.id}`, toAsObject(item)]),
	);
	return entries.flatMap((entry): AsDocument[] => {
		if (entry.activity === "delete")
			return entry.tombstone ? [deleteActivity(entry.tombstone)] : [];
		const object = entry.tombstone
			? toTombstone(entry.tombstone)
			: objects.get(`${entry.type}:${entry.id}`);
		return object
			? [createActivity(entry.type, entry.id, entry.at, object)]
			: [];
	});
}

/**
 * `GET /social/outbox[?page=first|<cursor>]`: the actor's outbox, an `OrderedCollection` of
 * the site's public, approved notes and articles in reverse chronological order (FEP-b06c),
 * with `totalItems` and cursor pages that stay stable as new activities are prepended. ETag /
 * Last-Modified from the newest change; 304 answers. Public on purpose.
 */
export async function handleOutboxGet(event: RequestEvent): Promise<void> {
	requireActiveModule(event, MODULE_ID);
	const page = event.url.searchParams.get("page");
	const contentType = activityContentType(event.request.headers.get("accept"));
	const version = await publicFeed.version();
	const urls = socialUrls();
	const representation = contentType.startsWith("application/ld") ? "ld" : "as";
	const cursor = page && page !== FIRST_PAGE ? page : null;
	// A malformed cursor is a 400 before any caching headers are set.
	const entries =
		page === null
			? null
			: await publicFeed.entries({ limit: OUTBOX_PAGE_SIZE, cursor });
	if (page !== null && !entries) throw event.error(400, "Unknown page");
	event.headers.set("Access-Control-Allow-Origin", "*");
	await sendCached(
		event,
		{
			etag: `"outbox-${representation}-${page ?? "collection"}-${version.tag}"`,
			lastModified: version.lastModified,
		},
		async () => {
			const document = entries
				? {
						"@context": AS_CONTEXT,
						id: `${urls.outbox}?page=${page}`,
						type: "OrderedCollectionPage",
						partOf: urls.outbox,
						orderedItems: await toActivities(entries.entries),
						...(entries.nextCursor
							? { next: `${urls.outbox}?page=${entries.nextCursor}` }
							: {}),
					}
				: {
						"@context": AS_CONTEXT,
						id: urls.outbox,
						type: "OrderedCollection",
						attributedTo: urls.actor,
						totalItems: await publicFeed.totalEntries(),
						first: `${urls.outbox}?page=${FIRST_PAGE}`,
					};
			return {
				body: JSON.stringify(assertNoPrivateFields(document)),
				contentType,
			};
		},
		{ vary: "Accept" },
	);
}

const asType = (value: string | undefined): StreamType | null =>
	value === "note" || value === "article" ? value : null;

/**
 * `GET /social/objects/<note|article>/<id>`: the object of a public, approved note or article
 * (its canonical HTML page is its `url`); after it left the public feeds, its `Tombstone` with
 * 410 Gone; 404 for anything never public. Public on purpose.
 */
export async function handleObjectGet(event: RequestEvent): Promise<void> {
	requireActiveModule(event, MODULE_ID);
	const type = asType(event.params.type);
	const found = type ? await publicFeed.get(type, event.params.id) : null;
	if (!found) throw event.error(404, "Not found");
	const contentType = activityContentType(event.request.headers.get("accept"));
	if (found.tombstone) {
		await sendJsonDocument(
			event,
			{ "@context": AS_CONTEXT, ...toTombstone(found.tombstone) },
			{ contentType, status: 410, lastModified: found.tombstone.deletedAt },
		);
		return;
	}
	const [item] = await toFeedItems([found.item]);
	await sendJsonDocument(
		event,
		assertNoPrivateFields({ "@context": AS_CONTEXT, ...toAsObject(item) }),
		{ contentType, lastModified: item.updatedAt },
	);
}

/**
 * `GET /social/activities/<create|delete>/<note|article>/<id>`: one activity of the outbox
 * (its `Create`, with a `Tombstone` object once the item left; its `Delete` after that).
 * 404 otherwise. Public on purpose.
 */
export async function handleActivityGet(event: RequestEvent): Promise<void> {
	requireActiveModule(event, MODULE_ID);
	const { verb, id } = event.params;
	const type = asType(event.params.type);
	const found =
		type && (verb === "create" || verb === "delete")
			? await publicFeed.get(type, id)
			: null;
	if (!type || !found || (verb === "delete" && !found.tombstone))
		throw event.error(404, "Not found");
	let activity: AsDocument;
	if (found.tombstone) {
		activity =
			verb === "delete"
				? deleteActivity(found.tombstone)
				: createActivity(
						type,
						id,
						found.tombstone.publishedAt,
						toTombstone(found.tombstone),
					);
	} else {
		const [item] = await toFeedItems([found.item]);
		activity = createActivity(type, id, item.publishedAt, toAsObject(item));
	}
	await sendJsonDocument(
		event,
		assertNoPrivateFields({ "@context": AS_CONTEXT, ...activity }),
		{
			contentType: activityContentType(event.request.headers.get("accept")),
		},
	);
}
