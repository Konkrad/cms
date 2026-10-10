import { component$ } from "@qwik.dev/core";
import { routeLoader$ } from "@qwik.dev/router";
import { AdminEventCompTickets } from "../../../../../../../modules/events/admin/comp-tickets";
import { loadAdminCompTickets } from "../../../../../../../modules/events/admin/comp-tickets-data";

export { useIssueCompTicket } from "../../../../../../../modules/events/admin/comp-tickets";

export const useEventData = routeLoader$((event) =>
	loadAdminCompTickets(event),
);

export default component$(() => {
	const data = useEventData();
	return <AdminEventCompTickets data={data.value} />;
});
