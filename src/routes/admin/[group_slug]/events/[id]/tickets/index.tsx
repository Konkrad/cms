import { component$ } from "@qwik.dev/core";
import { routeLoader$ } from "@qwik.dev/router";
import { assertNoPrivateFields } from "~/core/shared/no-private-fields";
import { AdminEventTickets } from "../../../../../../../modules/events/admin/tickets";
import { loadAdminTickets } from "../../../../../../../modules/events/admin/tickets-data";

export { useScanTicketByQr } from "../../../../../../../modules/events/admin/tickets";

export const useTickets = routeLoader$(async (event) =>
	assertNoPrivateFields(await loadAdminTickets(event), {
		// Admin ticket list: search by buyer email; manual scan submits the QR code uuid.
		allow: ["email", "qrCodeUuid"],
	}),
);

export default component$(() => {
	const tickets = useTickets();
	return <AdminEventTickets tickets={tickets.value} />;
});
