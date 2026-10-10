import { component$ } from "@qwik.dev/core";
import { routeLoader$ } from "@qwik.dev/router";
import { assertNoPrivateFields } from "~/core/shared/no-private-fields";
import { AdminDealNew } from "../../../../../../modules/deals/admin/new";
import { loadAdminDealNew } from "../../../../../../modules/deals/admin/new-data";

export { useCreateDeal } from "../../../../../../modules/deals/admin/new";

export const useGlobalOnly = routeLoader$(async (event) =>
	assertNoPrivateFields(await loadAdminDealNew(event)),
);

export default component$(() => {
	useGlobalOnly();
	return <AdminDealNew />;
});
