import { component$ } from "@qwik.dev/core";
import { type DocumentHead, routeLoader$ } from "@qwik.dev/router";
import { dealsService } from "~/services/deals.service";
import { publicImageUrlFromKey } from "~/utils/images";
import { canonicalUrl } from "~/utils/seo";
import { getServerSession } from "~/utils/server-auth";
import { DealView } from "~theme/routes/deals/DealView";

export const useDeal = routeLoader$(async (event) => {
	const deal = await dealsService.getById(event.params.id);

	if (!deal) {
		throw event.error(404, "Deal not found");
	}

	const now = new Date().toISOString();
	if (deal.validUntil && deal.validUntil < now) {
		throw event.error(404, "This deal is no longer available");
	}

	const user = await getServerSession(event);
	const isLoggedIn = !!user;

	return {
		deal,
		isLoggedIn,
	};
});

export default component$(() => {
	const deal = useDeal();
	return <DealView deal={deal.value.deal} isLoggedIn={deal.value.isLoggedIn} />;
});

export const head: DocumentHead = ({ resolveValue, url }) => {
	try {
		const { deal } = resolveValue(useDeal);
		const canonical = canonicalUrl(url.pathname);
		const description = deal.description || `Member deal: ${deal.name}`;
		const logoUrl = publicImageUrlFromKey(deal.logo);

		return {
			title: deal.name,
			meta: [
				{ name: "description", content: description },
				{ property: "og:type", content: "website" },
				{ property: "og:title", content: deal.name },
				{ property: "og:description", content: description },
				{ property: "og:url", content: canonical },
				...(logoUrl ? [{ property: "og:image", content: logoUrl }] : []),
			],
			links: [{ rel: "canonical", href: canonical }],
		};
	} catch {
		return { title: "Deal Not Found" };
	}
};
