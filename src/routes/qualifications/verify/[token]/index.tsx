import { component$ } from "@qwik.dev/core";
import { routeLoader$ } from "@qwik.dev/router";
import { qualificationsService } from "~/services/qualifications.service";
import { QualificationVerifyView } from "~theme/routes/qualifications/QualificationVerifyView";

export const useVerify = routeLoader$(async (event) => {
  const { requireAuth } = await import("~/utils/server-auth");
  const user = await requireAuth(event);

  const token = event.params.token;
  const result = await qualificationsService.redeemToken(token, user.id);

  return { ...result, userId: user.id };
});

export default component$(() => {
  const result = useVerify();
  return <QualificationVerifyView result={result.value} />;
});
