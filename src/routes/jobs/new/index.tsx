import { component$ } from "@qwik.dev/core";
import { routeAction$, routeLoader$, z, zod$ } from "@qwik.dev/router";
import { jobsService } from "~/services/jobs.service";
import { useThemeNamedExports$ } from "~/utils/theme-loader";
import { ThemeNamedExport } from "~/utils/theme-components";
import type { JobFormInitialValues } from "~theme/routes/jobs/JobFormView";

export const useCurrentUser = routeLoader$(async (event) => {
  const { requireAuth } = await import("~/utils/server-auth");
  const user = await requireAuth(event);
  return { user };
});

const MAX_DAYS = 30;

export const useSubmitJob = routeAction$(
  async (data, event) => {
    const { requireAuth } = await import("~/utils/server-auth");
    const user = await requireAuth(event);

    const expiresAt = new Date(data.expiresAt);
    const maxExpiry = new Date();
    maxExpiry.setDate(maxExpiry.getDate() + MAX_DAYS);

    if (expiresAt > maxExpiry) {
      return {
        failed: true,
        error: "Expiry date cannot be more than 30 days from today.",
      };
    }

    await jobsService.create({
      title: data.title,
      body: data.body,
      editorState: data.editorState || null,
      locationType: data.locationType as
        | "on-site"
        | "remote-eu"
        | "remote-country",
      city: data.city || null,
      country: data.country || null,
      link: data.link || null,
      posterRelation: data.posterRelation || null,
      expiresAt,
      status: "pending",
      suggestedBy: user.id,
    } as any);

    throw event.redirect(303, "/jobs/mine");
  },
  zod$({
    title: z.string().min(1, "Title is required"),
    body: z.string(),
    editorState: z.string().optional(),
    locationType: z.enum(["on-site", "remote-eu", "remote-country"]),
    city: z.string().optional(),
    country: z.string().optional(),
    link: z.string().optional(),
    posterRelation: z
      .enum(["hiring", "founder", "direct-team", "works-there", "other", ""])
      .optional(),
    expiresAt: z.string().min(1, "Expiry date is required"),
  }),
);

export default component$(() => {
  useCurrentUser();
  const submitAction = useSubmitJob();

  const maxDate = new Date();
  maxDate.setDate(maxDate.getDate() + 30);
  const maxDateStr = maxDate.toISOString().slice(0, 10);

  const initial: JobFormInitialValues = {
    title: "",
    editorState: null,
    body: "",
    locationType: "on-site",
    city: "",
    country: "",
    link: "",
    posterRelation: "",
    expiresAt: maxDateStr,
  };

  const { JobFormView } = useThemeNamedExports$(
    async () => import("~theme/routes/jobs/JobFormView"),
  );

  return (
    <ThemeNamedExport
      resource={JobFormView}
      mode="new"
      backHref="/jobs"
      backLabel="Back to Job Board"
      heading="Post a Job"
      initial={initial}
      maxDateStr={maxDateStr}
      cancelHref="/jobs"
      submitLabel="Submit for Review"
      submittingLabel="Submitting…"
      action={submitAction}
    />
  );
});
