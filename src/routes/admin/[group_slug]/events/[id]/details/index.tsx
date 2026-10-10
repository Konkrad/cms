import { component$ } from "@qwik.dev/core";
import { routeLoader$ } from "@qwik.dev/router";
import { assertNoPrivateFields } from "~/core/shared/no-private-fields";
import { AdminEventDetails } from "../../../../../../../modules/events/admin/details";
import { loadAdminEventDetails } from "../../../../../../../modules/events/admin/details-data";

export { useUpdateEventDetails } from "../../../../../../../modules/events/admin/details";

export const useEvent = routeLoader$(async (event) =>
	assertNoPrivateFields(await loadAdminEventDetails(event), {
		// The event venue's coordinates (shown/edited by admins), not a person's location.
		allow: ["latitude", "longitude"],
	}),
);

export default component$(() => {
	const event = useEvent();
	return <AdminEventDetails event={event.value} />;
});
