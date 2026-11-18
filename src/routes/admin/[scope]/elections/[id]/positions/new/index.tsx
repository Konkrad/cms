import { component$ } from "@qwik.dev/core";
import { routeLoader$ } from "@qwik.dev/router";
import { assertNoPrivateFields } from "~/core/shared/no-private-fields";
import { loadAdminNewPosition } from "../../../../../../../modules/elections/admin/data";
import { AdminNewPosition } from "../../../../../../../modules/elections/admin/position-new";

export { useCreatePosition } from "../../../../../../../modules/elections/admin/actions";

export const useGuard = routeLoader$(async (event) =>
	assertNoPrivateFields(await loadAdminNewPosition(event)),
);

export default component$(() => {
	const guard = useGuard();
	return <AdminNewPosition data={guard.value} />;
});
