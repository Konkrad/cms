import { component$ } from "@qwik.dev/core";
import { routeLoader$ } from "@qwik.dev/router";
import { qualificationsService } from "~/services/qualifications.service";
import { useThemeNamedExports$ } from "~/utils/theme-loader";

export const useVerify = routeLoader$(async (event) => {
  const { requireAuth } = await import("~/utils/server-auth");
  const user = await requireAuth(event);

  const token = event.params.token;
  const result = await qualificationsService.redeemToken(token, user.id);

  return { ...result, userId: user.id };
});

export default component$(() => {
  const result = useVerify();

  const { QualificationVerifyView } = useThemeNamedExports$(
    async () => import("~theme/routes/qualifications/QualificationVerifyView"),
  );

  return (
    QualificationVerifyView.value && (
      <QualificationVerifyView.value result={result.value} />
    )
  );
});
