import { component$ } from "@qwik.dev/core";
import { routeLoader$ } from "@qwik.dev/router";
import { assertNoPrivateFields } from "~/core/shared/no-private-fields";
import { AdminEventNew } from "../../../../../modules/events/admin/new";
import { loadNewEventContext } from "../../../../../modules/events/admin/new-data";

export { useCreateEvent } from "../../../../../modules/events/admin/new";

export const useGroupContext = routeLoader$(async (event) =>
	assertNoPrivateFields(await loadNewEventContext(event)),
);

export default component$(() => {
	const groupContext = useGroupContext();
	return <AdminEventNew groupContext={groupContext.value} />;
});
