import { component$ } from "@qwik.dev/core";
import { type DocumentHead, routeLoader$ } from "@qwik.dev/router";
import { t } from "~/core/i18n";
import { assertNoPrivateFields } from "~/core/shared/no-private-fields";
import { AdminEventAttendance } from "../../../../../../modules/events/admin/attendance";
import { loadAdminAttendance } from "../../../../../../modules/events/admin/attendance-data";

export const useAttendance = routeLoader$(async (event) =>
	assertNoPrivateFields(await loadAdminAttendance(event), {
		// Admin attendance list: buyer and participant emails, ticket QR code uuids.
		allow: ["email", "qrCodeUuid"],
	}),
);

export default component$(() => {
	const data = useAttendance();
	return <AdminEventAttendance data={data.value} />;
});

export const head: DocumentHead = ({ resolveValue }) => {
	const { event } = resolveValue(useAttendance);
	return {
		title: t("admin.events.attendance.title", { title: event.title }),
		meta: [
			{
				name: "description",
				content: t("admin.events.attendance.description", {
					title: event.title,
				}),
			},
		],
	};
};
