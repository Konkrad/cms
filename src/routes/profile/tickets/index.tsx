import { component$ } from "@qwik.dev/core";
import { routeLoader$ } from "@qwik.dev/router";
import { ProfileTickets } from "../../../../modules/events/profile-tickets";
import { loadUserDashboard } from "../../../../modules/events/profile-tickets-data";

export { useUpdateParticipants } from "../../../../modules/events/profile-tickets";

export const useUserDashboard = routeLoader$((event) =>
	loadUserDashboard(event),
);

export default component$(() => {
	const dashboard = useUserDashboard();
	return <ProfileTickets dashboard={dashboard.value} />;
});
