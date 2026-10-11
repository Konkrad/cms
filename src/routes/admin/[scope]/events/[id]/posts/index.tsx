import { component$ } from "@qwik.dev/core";
import { type DocumentHead, routeLoader$ } from "@qwik.dev/router";
import { assertNoPrivateFields } from "~/core/shared/no-private-fields";
import { AdminEventPosts } from "../../../../../../modules/events/admin/posts";
import { loadAdminEventPosts } from "../../../../../../modules/events/admin/posts-data";

export {
	useCreateEventPost,
	useDeleteEventPost,
} from "../../../../../../modules/events/admin/posts";

export const useEventPosts = routeLoader$(async (event) =>
	assertNoPrivateFields(await loadAdminEventPosts(event)),
);

export default component$(() => {
	const data = useEventPosts();
	return <AdminEventPosts data={data.value} />;
});

export const head: DocumentHead = ({ resolveValue }) => {
	const { event } = resolveValue(useEventPosts);
	return { title: `Posts - ${event.title}` };
};
