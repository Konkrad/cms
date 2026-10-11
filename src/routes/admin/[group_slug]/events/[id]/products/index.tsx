import { component$ } from "@qwik.dev/core";
import { routeLoader$ } from "@qwik.dev/router";
import { assertNoPrivateFields } from "~/core/shared/no-private-fields";
import { AdminEventProducts } from "../../../../../../modules/events/admin/products";
import { loadAdminProducts } from "../../../../../../modules/events/admin/products-data";

export {
	useCreateInventoryGroup,
	useCreateProduct,
} from "../../../../../../modules/events/admin/products";

export const useInventoryGroupsAndProducts = routeLoader$(async (event) =>
	assertNoPrivateFields(await loadAdminProducts(event)),
);

export default component$(() => {
	const data = useInventoryGroupsAndProducts();
	return <AdminEventProducts data={data.value} />;
});
