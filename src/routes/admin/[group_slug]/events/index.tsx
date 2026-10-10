import { component$ } from "@qwik.dev/core";
import { routeLoader$ } from "@qwik.dev/router";
import { AdminEventsList } from "../../../../../modules/events/admin/list";
import { loadAdminEvents } from "../../../../../modules/events/admin/list-data";

export { useDeleteEvent } from "../../../../../modules/events/admin/list";

export const useEvents = routeLoader$((event) => loadAdminEvents(event));

export default component$(() => {
	const data = useEvents();
	return <AdminEventsList data={data.value} />;
});
