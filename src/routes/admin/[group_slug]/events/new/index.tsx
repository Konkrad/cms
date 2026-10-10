import { component$ } from "@qwik.dev/core";
import { routeLoader$ } from "@qwik.dev/router";
import { AdminEventNew } from "../../../../../../modules/events/admin/new";
import { loadNewEventContext } from "../../../../../../modules/events/admin/new-data";

export { useCreateEvent } from "../../../../../../modules/events/admin/new";

export const useGroupContext = routeLoader$((event) =>
	loadNewEventContext(event),
);

export default component$(() => {
	const groupContext = useGroupContext();
	return <AdminEventNew groupContext={groupContext.value} />;
});
