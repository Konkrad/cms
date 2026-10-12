import { component$ } from "@qwik.dev/core";
import { type DocumentHead, routeLoader$ } from "@qwik.dev/router";
import { t } from "~/core/i18n";
import { assertNoPrivateFields } from "~/core/shared/no-private-fields";
import { AdminEventParticipation } from "../../../../../../modules/events/admin/participation";
import { loadAdminParticipation } from "../../../../../../modules/events/admin/participation-data";

export const useParticipation = routeLoader$(async (event) =>
	assertNoPrivateFields(await loadAdminParticipation(event), {
		// Admin RSVP list for the event's organisers: each participant's email, and their food
		// preference and photo consent (event requirement answers) for catering and photography.
		allow: ["email", "foodPreference", "photoConsentGiven"],
	}),
);

export default component$(() => {
	const data = useParticipation();
	return <AdminEventParticipation data={data.value} />;
});

export const head: DocumentHead = ({ resolveValue }) => {
	const { event } = resolveValue(useParticipation);
	return {
		title: t("admin.events.participation.title", { title: event.title }),
		meta: [
			{
				name: "description",
				content: t("admin.events.participation.description", {
					title: event.title,
				}),
			},
		],
	};
};
