import { component$ } from "@qwik.dev/core";
import { routeLoader$ } from "@qwik.dev/router";
import { AdminEventTickets } from "../../../../../../../modules/events/admin/tickets";
import { loadAdminTickets } from "../../../../../../../modules/events/admin/tickets-data";

export { useScanTicketByQr } from "../../../../../../../modules/events/admin/tickets";

export const useTickets = routeLoader$((event) => loadAdminTickets(event));

export default component$(() => {
	const tickets = useTickets();
	return <AdminEventTickets tickets={tickets.value} />;
});
