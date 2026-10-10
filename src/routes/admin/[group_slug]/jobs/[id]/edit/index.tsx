import { component$ } from "@qwik.dev/core";
import { routeLoader$ } from "@qwik.dev/router";
import { AdminJobEdit } from "../../../../../../../modules/jobs/admin/edit";
import { loadAdminJob } from "../../../../../../../modules/jobs/admin/edit-data";

export { useUpdateJob } from "../../../../../../../modules/jobs/admin/edit";

export const useJob = routeLoader$(async (event) => {
	const job = await loadAdminJob(event);
	if (!job) throw event.redirect(302, "/admin/global/jobs");
	return { job };
});

export default component$(() => {
	const data = useJob();
	return <AdminJobEdit job={data.value.job} />;
});
