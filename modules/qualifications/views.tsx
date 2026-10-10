import { component$ } from "@qwik.dev/core";
import type { QualificationVerifyViewData } from "~/contracts/qualifications";
import type { PageViews } from "~/core-api";
import { QualificationVerifyView } from "~theme/routes/qualifications/QualificationVerifyView";

const QualificationVerifyPage = component$<{
	data: QualificationVerifyViewData;
}>(({ data }) => <QualificationVerifyView result={data} />);

export const qualificationsViews: PageViews = {
	"qualifications.verify": { view: QualificationVerifyPage },
};
