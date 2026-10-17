import { component$ } from "@qwik.dev/core";
import { type DocumentHead, routeLoader$ } from "@qwik.dev/router";
import { t } from "~/core/i18n";
import { assertNoPrivateFields } from "~/core/shared/no-private-fields";
import { AdminEventReview } from "../../../../../../modules/events/admin/review";
import { loadAdminEventReview } from "../../../../../../modules/events/admin/review-data";

export {
	useSubmitDebrief,
	useSubmitProposal,
} from "../../../../../../modules/events/admin/review";

export const useEventReview = routeLoader$(async (event) =>
	assertNoPrivateFields(await loadAdminEventReview(event)),
);

export default component$(() => {
	const data = useEventReview();
	return <AdminEventReview data={data.value} />;
});

export const head: DocumentHead = ({ resolveValue }) => {
	const { event } = resolveValue(useEventReview);
	return { title: t("admin.events.review.title", { title: event.title }) };
};
