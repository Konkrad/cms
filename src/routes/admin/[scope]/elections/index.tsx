import { component$ } from "@qwik.dev/core";
import { routeLoader$ } from "@qwik.dev/router";
import { assertNoPrivateFields } from "~/core/shared/no-private-fields";
import { loadAdminElections } from "../../../../modules/elections/admin/data";
import { AdminElectionsList } from "../../../../modules/elections/admin/list";

export const useElectionsData = routeLoader$(async (event) =>
	assertNoPrivateFields(await loadAdminElections(event)),
);

export default component$(() => {
	const data = useElectionsData();
	return <AdminElectionsList data={data.value} />;
});
