import { component$ } from "@qwik.dev/core";
import { routeLoader$ } from "@qwik.dev/router";
import { assertNoPrivateFields } from "~/core/shared/no-private-fields";
import { AdminDealsList } from "../../../../modules/deals/admin/list";
import { loadAdminDeals } from "../../../../modules/deals/admin/list-data";

export { useDeleteDeal } from "../../../../modules/deals/admin/list";

export const useDeals = routeLoader$(async (event) =>
	assertNoPrivateFields(await loadAdminDeals(event)),
);

export default component$(() => {
	const data = useDeals();
	return <AdminDealsList data={data.value} />;
});
