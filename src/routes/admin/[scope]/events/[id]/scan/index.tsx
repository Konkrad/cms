import { component$ } from "@qwik.dev/core";
import { type DocumentHead, routeLoader$ } from "@qwik.dev/router";
import { t } from "~/core/i18n";
import { assertNoPrivateFields } from "~/core/shared/no-private-fields";
import { AdminEventScan } from "../../../../../../modules/events/admin/scan";
import { loadAdminScan } from "../../../../../../modules/events/admin/scan-data";

export { useScanEventTicket } from "../../../../../../modules/events/admin/scan";

export const useEvent = routeLoader$(async (event) =>
	assertNoPrivateFields(await loadAdminScan(event)),
);

export default component$(() => {
	const event = useEvent();
	return <AdminEventScan event={event.value} />;
});

export const head: DocumentHead = ({ resolveValue }) => {
	const event = resolveValue(useEvent);
	return {
		title: t("admin.events.scan.title", { title: event.title }),
		meta: [
			{
				name: "description",
				content: t("admin.events.scan.description", { title: event.title }),
			},
		],
	};
};
