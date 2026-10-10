import type { RequestEventLoader } from "@qwik.dev/router";
import { pagesService } from "~/services/pages.service";

/** Published CMS page at `url`, or null with a 404 status (server only). */
export async function loadCmsPage(
	{ status }: Pick<RequestEventLoader, "status">,
	url: string,
) {
	const page = await pagesService.getByUrl(url);
	if (!page || page.status !== "published") {
		status(404);
		return null;
	}
	return page;
}
