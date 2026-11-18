import { component$ } from "@qwik.dev/core";
import { routeLoader$ } from "@qwik.dev/router";
import { assertNoPrivateFields } from "~/core/shared/no-private-fields";
import { AdminEventEdit } from "../../../../../../modules/events/admin/edit";
import { loadAdminEventEdit } from "../../../../../../modules/events/admin/edit-data";
import { loadNewEventContext } from "../../../../../../modules/events/admin/new-data";

export { useEditEvent } from "../../../../../../modules/events/admin/edit";

export const useGroupContext = routeLoader$(async (event) =>
	assertNoPrivateFields(await loadNewEventContext(event)),
);

export const useEventData = routeLoader$(async (event) =>
	assertNoPrivateFields(await loadAdminEventEdit(event), {
		// The event venue's coordinates (shown/edited by admins), not a person's location.
		allow: ["latitude", "longitude"],
	}),
);

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
