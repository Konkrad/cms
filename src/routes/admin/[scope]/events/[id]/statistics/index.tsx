import { component$ } from "@qwik.dev/core";
import { type DocumentHead, routeLoader$ } from "@qwik.dev/router";
import { t } from "~/core/i18n";
import { assertNoPrivateFields } from "~/core/shared/no-private-fields";
import { AdminEventStatistics } from "../../../../../../modules/events/admin/statistics";
import { loadAdminEventStatistics } from "../../../../../../modules/events/admin/statistics-data";

export const useEventStatistics = routeLoader$(async (event) =>
	assertNoPrivateFields(await loadAdminEventStatistics(event)),
);

export default component$(() => {
	const data = useEventStatistics();
	return <AdminEventStatistics data={data.value} />;
});

export const head: DocumentHead = ({ resolveValue }) => {
	const { event } = resolveValue(useEventStatistics);
	return {
		title: t("admin.events.statistics.title", { title: event.title }),
	};
};
