import { component$ } from "@qwik.dev/core";
import { routeLoader$ } from "@qwik.dev/router";
import { assertNoPrivateFields } from "~/core/shared/no-private-fields";
import { AdminJobsList } from "../../../../modules/jobs/admin/list";
import { loadAdminJobs } from "../../../../modules/jobs/admin/list-data";

export {
	useApproveJob,
	useDeleteJob,
} from "../../../../modules/jobs/admin/list";

export const useJobs = routeLoader$(async (event) =>
	assertNoPrivateFields(await loadAdminJobs(event)),
);

export default component$(() => {
	const data = useJobs();
	return <AdminJobsList data={data.value} />;
});
