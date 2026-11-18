import { component$ } from "@qwik.dev/core";
import type { ApplyViewData } from "~/contracts/elections";
import type { PageViews } from "~/core";
import { ApplyView } from "~theme/routes/elections/ApplyView";
import { ElectionDetailView } from "~theme/routes/elections/ElectionDetailView";
import { ElectionsView } from "~theme/routes/elections/ElectionsView";
import { MyApplicationsView } from "~theme/routes/elections/MyApplicationsView";
import { useSubmitApplication } from "./actions";

const ApplyPage = component$<{ data: ApplyViewData }>(({ data }) => {
	const submitAction = useSubmitApplication();
	return <ApplyView data={data} submitAction={submitAction} />;
});

export const electionsViews: PageViews = {
	"elections.list": { view: ElectionsView },
	"elections.mine": { view: MyApplicationsView },
	"elections.detail": { view: ElectionDetailView },
	"elections.apply": { view: ApplyPage },
};
