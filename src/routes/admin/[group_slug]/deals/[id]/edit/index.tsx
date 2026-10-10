import { component$ } from "@qwik.dev/core";
import { routeLoader$ } from "@qwik.dev/router";
import { AdminDealEdit } from "../../../../../../../modules/deals/admin/edit";
import { loadAdminDeal } from "../../../../../../../modules/deals/admin/edit-data";

export { useUpdateDeal } from "../../../../../../../modules/deals/admin/edit";

export const useDeal = routeLoader$(async (event) => {
	const loaded = await loadAdminDeal(event);
	if (!loaded) throw event.redirect(303, "/admin/global/deals");
	return loaded;
});

export default component$(() => {
	const data = useDeal();
	return <AdminDealEdit data={data.value} />;
});
