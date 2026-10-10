import { component$ } from "@qwik.dev/core";
import { type DocumentHead, routeLoader$ } from "@qwik.dev/router";
import { AdminEventScan } from "../../../../../../../modules/events/admin/scan";
import { loadAdminScan } from "../../../../../../../modules/events/admin/scan-data";

export { useScanEventTicket } from "../../../../../../../modules/events/admin/scan";

export const useEvent = routeLoader$((event) => loadAdminScan(event));

export default component$(() => {
	const event = useEvent();
	return <AdminEventScan event={event.value} />;
});

export const head: DocumentHead = ({ resolveValue }) => {
	const event = resolveValue(useEvent);
	return {
		title: `Scan Tickets - ${event.title}`,
		meta: [
			{
				name: "description",
				content: `Scan tickets for ${event.title} event`,
			},
		],
	};
};
