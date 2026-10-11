import { component$ } from "@qwik.dev/core";
import { routeLoader$ } from "@qwik.dev/router";
import { assertNoPrivateFields } from "~/core/shared/no-private-fields";
import { ProfileTickets } from "../../../modules/events/profile-tickets";
import { loadUserDashboard } from "../../../modules/events/profile-tickets-data";

export { useUpdateParticipants } from "../../../modules/events/profile-tickets";

export const useUserDashboard = routeLoader$(async (event) =>
	assertNoPrivateFields(await loadUserDashboard(event), {
		// The viewer's OWN tickets: the QR wall renders each ticket's QR code.
		allow: ["qrCodeUuid"],
	}),
);

export default component$(() => {
	const dashboard = useUserDashboard();
	return <ProfileTickets dashboard={dashboard.value} />;
});
