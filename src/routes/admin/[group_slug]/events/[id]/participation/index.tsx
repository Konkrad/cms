import { component$ } from "@qwik.dev/core";
import { type DocumentHead, routeLoader$ } from "@qwik.dev/router";
import { assertNoPrivateFields } from "~/core/shared/no-private-fields";
import { AdminEventParticipation } from "../../../../../../modules/events/admin/participation";
import { loadAdminParticipation } from "../../../../../../modules/events/admin/participation-data";

export const useParticipation = routeLoader$(async (event) =>
	assertNoPrivateFields(await loadAdminParticipation(event), {
		// Admin RSVP list shows each participant's email.
		allow: ["email"],
	}),
);

export default component$(() => {
	const data = useParticipation();
	return <AdminEventParticipation data={data.value} />;
});

export const head: DocumentHead = ({ resolveValue }) => {
	const { event } = resolveValue(useParticipation);
	return {
		title: `Participation Summary - ${event.title}`,
		meta: [
			{
				name: "description",
				content: `Participation summary for ${event.title} event`,
			},
		],
	};
};
