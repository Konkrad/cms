import { component$ } from "@qwik.dev/core";
import { type DocumentHead, routeLoader$ } from "@qwik.dev/router";
import { t } from "~/core/i18n";
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
		title: t("admin.events.photos.title", { title: event.title }),
		meta: [
			{
				name: "description",
				content: t("admin.events.photos.description", { title: event.title }),
			},
		],
	};
};
