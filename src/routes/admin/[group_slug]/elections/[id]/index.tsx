import { component$ } from "@qwik.dev/core";
import { routeLoader$ } from "@qwik.dev/router";
import { assertNoPrivateFields } from "~/core/shared/no-private-fields";
import { AdminElectionCycle } from "../../../../../../modules/elections/admin/cycle";
import { loadAdminCycle } from "../../../../../../modules/elections/admin/data";

export {
	useAdvanceStatus,
	useApproveApplication,
	useDeletePosition,
	useRejectApplication,
	useSetVotingUrl,
} from "../../../../../../modules/elections/admin/actions";

export const useCycleData = routeLoader$(async (event) =>
	assertNoPrivateFields(await loadAdminCycle(event), {
		// Admins write and read the internal note on each application.
		allow: ["adminNote"],
	}),
);

export default component$(() => {
	const data = useCycleData();
	return <AdminElectionCycle data={data.value} />;
});
