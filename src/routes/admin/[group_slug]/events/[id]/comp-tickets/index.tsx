import { component$ } from "@qwik.dev/core";
import { routeLoader$ } from "@qwik.dev/router";
import { assertNoPrivateFields } from "~/core/shared/no-private-fields";
import { AdminEventCompTickets } from "../../../../../../../modules/events/admin/comp-tickets";
import { loadAdminCompTickets } from "../../../../../../../modules/events/admin/comp-tickets-data";

export { useIssueCompTicket } from "../../../../../../../modules/events/admin/comp-tickets";

export const useEventData = routeLoader$(async (event) =>
	assertNoPrivateFields(await loadAdminCompTickets(event)),
);

export default component$(() => {
	const data = useEventData();
	return <AdminEventCompTickets data={data.value} />;
});
