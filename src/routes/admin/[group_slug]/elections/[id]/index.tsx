import { component$ } from "@qwik.dev/core";
import { routeLoader$ } from "@qwik.dev/router";
import { AdminElectionCycle } from "../../../../../../modules/elections/admin/cycle";
import { loadAdminCycle } from "../../../../../../modules/elections/admin/data";

export {
	useAdvanceStatus,
	useApproveApplication,
	useDeletePosition,
	useRejectApplication,
	useSetVotingUrl,
} from "../../../../../../modules/elections/admin/actions";

export const useCycleData = routeLoader$((event) => loadAdminCycle(event));

export default component$(() => {
	const data = useCycleData();
	return <AdminElectionCycle data={data.value} />;
});
