import { component$ } from "@qwik.dev/core";
import { type DocumentHead, routeLoader$ } from "@qwik.dev/router";
import { assertNoPrivateFields } from "~/core/shared/no-private-fields";
import { AdminEventPhotos } from "../../../../../../modules/events/admin/photos";
import { loadAdminPhotos } from "../../../../../../modules/events/admin/photos-data";

export {
	useCreatePhoto,
	useDeletePhoto,
} from "../../../../../../modules/events/admin/photos";

export const usePhotos = routeLoader$(async (event) =>
	assertNoPrivateFields(await loadAdminPhotos(event)),
);

export default component$(() => {
	const data = usePhotos();
	return <AdminEventPhotos data={data.value} />;
});

export const head: DocumentHead = ({ resolveValue }) => {
	const { event } = resolveValue(usePhotos);
	return {
		title: `Manage Photos - ${event.title}`,
		meta: [
			{
				name: "description",
				content: `Upload and manage photos for ${event.title} event`,
			},
		],
	};
};
