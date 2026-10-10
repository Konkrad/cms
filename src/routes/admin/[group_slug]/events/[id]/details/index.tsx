import { component$ } from "@qwik.dev/core";
import { routeLoader$ } from "@qwik.dev/router";
import { AdminEventDetails } from "../../../../../../../modules/events/admin/details";
import { loadAdminEventDetails } from "../../../../../../../modules/events/admin/details-data";

export { useUpdateEventDetails } from "../../../../../../../modules/events/admin/details";

export const useEvent = routeLoader$((event) => loadAdminEventDetails(event));

export default component$(() => {
	const event = useEvent();
	return <AdminEventDetails event={event.value} />;
});
