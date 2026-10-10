import { component$ } from "@qwik.dev/core";
import type { DealDetailData } from "~/contracts/deals";
import type { PageViews } from "~/core-api";
import { DealView } from "~theme/routes/deals/DealView";

const DealDetailPage = component$<{ data: DealDetailData }>(({ data }) => (
	<DealView deal={data.deal} isLoggedIn={data.isLoggedIn} />
));

export const dealsViews: PageViews = {
	"deals.detail": {
		view: DealDetailPage,
		head: (data, url) => {
			const { deal, logoUrl } = data as DealDetailData;
			const canonical = new URL(url.pathname, url.origin).toString();
			const description = deal.description || `Member deal: ${deal.name}`;
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
		},
	},
};
