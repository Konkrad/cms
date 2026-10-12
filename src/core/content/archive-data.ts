import type { RequestEventLoader } from "@qwik.dev/router";
import type { ArchiveViewData } from "~/contracts/archive";
import { getServerSession } from "~/core/auth/server-auth";
import {
	ARCHIVE_TITLES,
	archiveFilter,
	type StreamFilter,
	streamFilterTypes,
} from "~/core/content/content-items";
import { stream } from "~/core/content/stream.service";
import { toStreamCards } from "~/core/content/stream-cards";
import { requestContentFilter } from "~/core/scopes/content-filter";

const PER_PAGE = 10;

const href = (show: StreamFilter, page: number) =>
	page === 0 ? `/archive/${show}` : `/archive/${show}/${page}`;

/**
 * Server-only: one page (0-based) of an archive (`scopeContentFilter` of the request: viewer
 * and URL scope), or null (with a 404) for an unknown type or a page past the end.
 */
export async function loadArchivePage(
	event: RequestEventLoader,
	page: number,
): Promise<ArchiveViewData> {
	const show = archiveFilter(event.params.type);
	if (!show || !Number.isInteger(page) || page < 0) {
		event.status(404);
		return null;
	}
	const result = await stream.page(
		await requestContentFilter(event),
		page,
		PER_PAGE,
		{ types: streamFilterTypes(show) },
	);
	if (page > 0 && page >= result.totalPages) {
		event.status(404);
		return null;
	}
	const viewer = await getServerSession(event);
	return {
		show,
		title: ARCHIVE_TITLES[show],
		startHref: href(show, 0),
		page,
		items: await toStreamCards(result.items, { loggedIn: !!viewer }),
		totalPages: result.totalPages,
		previousHref: page > 0 ? href(show, page - 1) : null,
		nextHref: page + 1 < result.totalPages ? href(show, page + 1) : null,
	};
}
