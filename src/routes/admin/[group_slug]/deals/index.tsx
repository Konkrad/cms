import { component$ } from "@qwik.dev/core";
import { routeLoader$ } from "@qwik.dev/router";
import { AdminDealsList } from "../../../../../modules/deals/admin/list";
import { loadAdminDeals } from "../../../../../modules/deals/admin/list-data";

export { useDeleteDeal } from "../../../../../modules/deals/admin/list";

export const useDeals = routeLoader$((event) => loadAdminDeals(event));

export default component$(() => {
	const data = useDeals();
	return <AdminDealsList data={data.value} />;
});
