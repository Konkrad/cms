import { component$ } from "@qwik.dev/core";
import { routeLoader$ } from "@qwik.dev/router";
import { loadAdminNewPosition } from "../../../../../../../../modules/elections/admin/data";
import { AdminNewPosition } from "../../../../../../../../modules/elections/admin/position-new";

export { useCreatePosition } from "../../../../../../../../modules/elections/admin/actions";

export const useGuard = routeLoader$((event) => loadAdminNewPosition(event));

export default component$(() => {
	const guard = useGuard();
	return <AdminNewPosition data={guard.value} />;
});
