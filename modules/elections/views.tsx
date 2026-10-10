import { component$ } from "@qwik.dev/core";
import type {
	ApplyViewData,
	ElectionDetailViewData,
	ElectionsViewData,
	MyApplicationsViewData,
} from "~/contracts/elections";
import type { PageViews } from "~/core-api";
import { ApplyView } from "~theme/routes/elections/ApplyView";
import { ElectionDetailView } from "~theme/routes/elections/ElectionDetailView";
import { ElectionsView } from "~theme/routes/elections/ElectionsView";
import { MyApplicationsView } from "~theme/routes/elections/MyApplicationsView";
import { useSubmitApplication } from "./actions";

const ElectionsPage = component$<{ data: ElectionsViewData }>(({ data }) => (
	<ElectionsView data={data} />
));

const MyApplicationsPage = component$<{ data: MyApplicationsViewData }>(
	({ data }) => <MyApplicationsView data={data} />,
);

const ElectionDetailPage = component$<{ data: ElectionDetailViewData }>(
	({ data }) => <ElectionDetailView data={data} />,
);

const ApplyPage = component$<{ data: ApplyViewData }>(({ data }) => {
	const submitAction = useSubmitApplication();
	return <ApplyView data={data} submitAction={submitAction} />;
});

export const electionsViews: PageViews = {
	"elections.list": { view: ElectionsPage },
	"elections.mine": { view: MyApplicationsPage },
	"elections.detail": { view: ElectionDetailPage },
	"elections.apply": { view: ApplyPage },
};
