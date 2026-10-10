import { component$ } from "@qwik.dev/core";
import { routeLoader$ } from "@qwik.dev/router";
import { AdminEventEdit } from "../../../../../../../modules/events/admin/edit";
import { loadAdminEventEdit } from "../../../../../../../modules/events/admin/edit-data";
import { loadNewEventContext } from "../../../../../../../modules/events/admin/new-data";

export { useEditEvent } from "../../../../../../../modules/events/admin/edit";

export const useGroupContext = routeLoader$((event) =>
	loadNewEventContext(event),
);

export const useEventData = routeLoader$((event) => loadAdminEventEdit(event));

export default component$(() => {
	const groupContext = useGroupContext();
	const eventData = useEventData();
	return (
		<AdminEventEdit
			groupContext={groupContext.value}
			eventData={eventData.value}
		/>
	);
});
