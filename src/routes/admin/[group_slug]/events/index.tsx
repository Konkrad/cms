import { component$ } from "@qwik.dev/core";
import { routeLoader$ } from "@qwik.dev/router";
import { assertNoPrivateFields } from "~/core/shared/no-private-fields";
import { AdminEventsList } from "../../../../../modules/events/admin/list";
import { loadAdminEvents } from "../../../../../modules/events/admin/list-data";

export { useDeleteEvent } from "../../../../../modules/events/admin/list";

export const useEvents = routeLoader$(async (event) =>
	assertNoPrivateFields(await loadAdminEvents(event)),
);

export default component$(() => {
	const data = useEvents();
	return <AdminEventsList data={data.value} />;
});
