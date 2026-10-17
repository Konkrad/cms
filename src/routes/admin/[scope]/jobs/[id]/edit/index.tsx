import { component$ } from "@qwik.dev/core";
import { routeLoader$ } from "@qwik.dev/router";
import { assertNoPrivateFields } from "~/core/shared/no-private-fields";
import { AdminJobEdit } from "../../../../../../modules/jobs/admin/edit";
import { loadAdminJob } from "../../../../../../modules/jobs/admin/edit-data";

export { useUpdateJob } from "../../../../../../modules/jobs/admin/edit";

export const useJob = routeLoader$(async (event) =>
	assertNoPrivateFields(await loadAdminJob(event)),
);

export default component$(() => {
	const data = useJob();
	return <AdminJobEdit data={data.value} />;
});
