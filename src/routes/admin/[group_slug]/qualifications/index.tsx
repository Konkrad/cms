import { component$ } from "@qwik.dev/core";
import { routeLoader$ } from "@qwik.dev/router";
import { loadAdminQualifications } from "../../../../../modules/qualifications/admin/data";
import { AdminQualifications } from "../../../../../modules/qualifications/admin/qualifications";

export {
	useApproveQualification,
	useCreateType,
	useDeleteType,
	useGenerateToken,
	useRejectQualification,
	useRevokeToken,
} from "../../../../../modules/qualifications/admin/actions";

export const useQualificationsData = routeLoader$((event) =>
	loadAdminQualifications(event),
);

export default component$(() => {
	const data = useQualificationsData();
	return <AdminQualifications data={data.value} />;
});
