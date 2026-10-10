import { component$ } from "@qwik.dev/core";
import { routeLoader$ } from "@qwik.dev/router";
import { assertNoPrivateFields } from "~/core/shared/no-private-fields";
import { guardNewElection } from "../../../../../../modules/elections/admin/data";
import { AdminNewElection } from "../../../../../../modules/elections/admin/new";

// The form's action must be exported from the route that renders it, or the router cannot find it.
export { useCreateCycle } from "../../../../../../modules/elections/admin/actions";

export const useGuard = routeLoader$(async (event) =>
	assertNoPrivateFields(await guardNewElection(event)),
);

export default component$(() => {
	useGuard();
	return <AdminNewElection />;
});
