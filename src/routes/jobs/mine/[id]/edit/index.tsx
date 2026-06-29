import { component$ } from "@qwik.dev/core";
import { routeAction$, routeLoader$, z, zod$ } from "@qwik.dev/router";
import { jobsService } from "~/services/jobs.service";
import { JobFormView, type JobFormInitialValues } from "~theme/routes/jobs/JobFormView";

export const useJob = routeLoader$(async (event) => {
  const { requireAuth } = await import("~/utils/server-auth");
  const user = await requireAuth(event);

  const job = await jobsService.getById(event.params.id);

  if (!job || job.suggestedBy !== user.id) {
    throw event.redirect(302, "/jobs/mine");
  }
  if (job.status !== "pending") {
    throw event.redirect(302, "/jobs/mine");
  }

  return { job };
});

const MAX_DAYS = 30;

export const useUpdateMyJob = routeAction$(
  async (data, event) => {
    const { requireAuth } = await import("~/utils/server-auth");
    const user = await requireAuth(event);

    const job = await jobsService.getById(event.params.id);
    if (!job || job.suggestedBy !== user.id || job.status !== "pending") {
      return { failed: true, error: "Not allowed." };
    }

    const expiresAt = new Date(data.expiresAt);
    const maxExpiry = new Date();
    maxExpiry.setDate(maxExpiry.getDate() + MAX_DAYS);

    if (expiresAt > maxExpiry) {
      return {
        failed: true,
        error: "Expiry date cannot be more than 30 days from today.",
      };
    }

    await jobsService.update(event.params.id, {
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
    posterRelation: z.preprocess(
      (v) => (v === "" ? undefined : v),
      z.enum(["hiring", "founder", "direct-team", "works-there", "other"]).optional(),
    ),
    expiresAt: z.string().min(1, "Expiry date is required"),
  }),
);

export default component$(() => {
  const data = useJob();
  const updateAction = useUpdateMyJob();
  const job = data.value.job;

  const maxDate = new Date();
  maxDate.setDate(maxDate.getDate() + 30);
  const maxDateStr = maxDate.toISOString().slice(0, 10);

  const initial: JobFormInitialValues = {
    title: job.title,
    editorState: job.editorState ?? null,
    body: job.body ?? "",
    locationType: job.locationType,
    city: job.city ?? "",
    country: job.country ?? "",
    link: job.link ?? "",
    posterRelation: job.posterRelation ?? "",
    expiresAt: job.expiresAt.slice(0, 10),
  };

  return (
    <JobFormView
      mode="edit"
      backHref="/jobs/mine"
      backLabel="Back to My Submissions"
      heading="Edit Job Posting"
      initial={initial}
      maxDateStr={maxDateStr}
      cancelHref="/jobs/mine"
      submitLabel="Save Changes"
      submittingLabel="Saving…"
      action={updateAction}
    />
  );
});
