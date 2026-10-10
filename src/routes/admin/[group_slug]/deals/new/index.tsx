import { component$ } from "@qwik.dev/core";
import { routeLoader$ } from "@qwik.dev/router";
import { AdminDealNew } from "../../../../../../modules/deals/admin/new";
import { loadAdminDealNew } from "../../../../../../modules/deals/admin/new-data";

export { useCreateDeal } from "../../../../../../modules/deals/admin/new";

export const useGlobalOnly = routeLoader$((event) => loadAdminDealNew(event));

export default component$(() => {
	useGlobalOnly();
	return <AdminDealNew />;
});
