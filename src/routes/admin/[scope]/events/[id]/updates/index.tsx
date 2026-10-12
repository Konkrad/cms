import { component$ } from "@qwik.dev/core";
import { type DocumentHead, routeLoader$ } from "@qwik.dev/router";
import { t } from "~/core/i18n";
import { assertNoPrivateFields } from "~/core/shared/no-private-fields";
import { AdminEventUpdates } from "../../../../../../modules/events/admin/updates";
import { loadAdminEventUpdates } from "../../../../../../modules/events/admin/updates-data";

export {
	useCreateEventArticle,
	useCreateEventNote,
	useDeleteEventUpdate,
} from "../../../../../../modules/events/admin/updates";

export const useEventUpdates = routeLoader$(async (event) =>
	assertNoPrivateFields(await loadAdminEventUpdates(event)),
);

export default component$(() => {
	const data = useEventUpdates();
	return <AdminEventUpdates data={data.value} />;
});

export const head: DocumentHead = ({ resolveValue }) => {
	const { event } = resolveValue(useEventUpdates);
	return { title: t("admin.events.updates.title", { title: event.title }) };
};
