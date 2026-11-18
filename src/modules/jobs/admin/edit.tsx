import { $, component$, useSignal } from "@qwik.dev/core";
import { routeAction$, z, zod$ } from "@qwik.dev/router";
import { requireModuleAdmin, requireWithinScope } from "~/core";
import { BlockNoteEditor, Button, Input, Select, t } from "~/core/ui";
import { notifyIfApproved } from "../notifications";
import { jobsService } from "../service";
import type { AdminJobData } from "./edit-data";

export const useUpdateJob = routeAction$(
	async (data, event) => {
		const { scope, adminBase } = await requireModuleAdmin(event, {
			module: "jobs",
		});

		const before = await jobsService.getById(event.params.id);
		await requireWithinScope(event, scope, before);
		if (!before)
			return event.fail(404, { message: t("jobs.admin.edit.jobNotFound") });
		const after = await jobsService.update(event.params.id, {
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
			expiresAt: new Date(data.expiresAt),
			status: data.status as "pending" | "approved",
		} as any);
		await notifyIfApproved(before, after);

		throw event.redirect(303, `${adminBase}/jobs`);
	},
	zod$({
		title: z.string().min(1, t("jobs.admin.edit.titleIsRequired")),
		body: z.string(),
		editorState: z.string().optional(),
		locationType: z.enum(["on-site", "remote-eu", "remote-country"]),
		city: z.string().optional(),
		country: z.string().optional(),
		link: z.string().optional(),
		posterRelation: z
			.enum(["hiring", "founder", "direct-team", "works-there", "other"])
			.optional(),
		expiresAt: z.string().min(1, t("jobs.admin.edit.expiryDateIsRequired")),
		status: z.enum(["pending", "approved"]),
	}),
);

export const AdminJobEdit = component$<{ data: AdminJobData }>(({ data }) => {
	const { job, adminBase } = data;
	const updateAction = useUpdateJob();

	const body = useSignal(job.body ?? "");
	const editorState = useSignal(job.editorState ?? "");
	const locationType = useSignal(job.locationType);

	const handleEditorChange$ = $((html: string, state: string) => {
		body.value = html;
		editorState.value = state;
	});

	return (
		<div>
			<div class="flex items-center justify-between mb-6">
				<h2 class="text-2xl font-bold text-gray-800">
					{t("jobs.admin.edit.editJob")}
				</h2>
				<Button href={`${adminBase}/jobs`} variant="secondary">
					{t("jobs.admin.edit.backToJobs")}
				</Button>
			</div>

			<div class="bg-white rounded-lg shadow-sm p-6">
				<form
					preventdefault:submit
					onSubmit$={() => {
						const form = document.querySelector("form") as HTMLFormElement;
						if (form) updateAction.submit(new FormData(form));
					}}
					class="space-y-6"
				>
					<Input
						name="title"
						label={t("jobs.admin.edit.title")}
						required
						value={job.title}
					/>

					<div>
						<span class="block text-sm font-medium text-gray-700 mb-2">
							{t("jobs.admin.edit.description")}
						</span>
						<div class="border border-gray-300 rounded-lg overflow-hidden">
							<BlockNoteEditor
								editorState={job.editorState ?? null}
								content={job.body}
								onChange$={handleEditorChange$}
								textOnly
								linkPicker
							/>
						</div>
					</div>
					<input type="hidden" name="body" value={body.value} />
					<input type="hidden" name="editorState" value={editorState.value} />

					<Select
						name="locationType"
						label={t("jobs.admin.edit.locationType")}
						value={job.locationType}
						onChange$={(e) => {
							locationType.value = (e.target as HTMLSelectElement).value as any;
						}}
					>
						<option value="on-site">{t("jobs.admin.edit.onSiteHybrid")}</option>
						<option value="remote-eu">{t("jobs.admin.edit.remoteEu")}</option>
						<option value="remote-country">
							{t("jobs.admin.edit.remoteSpecificCountry")}
						</option>
					</Select>

					{locationType.value === "on-site" && (
						<Input
							name="city"
							label={t("jobs.admin.edit.city")}
							value={job.city ?? ""}
						/>
					)}

					{(locationType.value === "on-site" ||
						locationType.value === "remote-country") && (
						<Input
							name="country"
							label={t("jobs.admin.edit.country")}
							value={job.country ?? ""}
						/>
					)}

					<Input
						name="link"
						label={t("jobs.admin.edit.applicationLinkCtaOptional")}
						type="url"
						value={job.link ?? ""}
						placeholder={t("jobs.admin.edit.https")}
					/>

					<Select
						name="posterRelation"
						label={t("jobs.admin.edit.posterSRelationToThe")}
						value={job.posterRelation ?? ""}
					>
						<option value="">{t("jobs.admin.edit.notSpecified")}</option>
						<option value="hiring">
							{t("jobs.admin.edit.hiringForThisRole")}
						</option>
						<option value="founder">{t("jobs.admin.edit.founder")}</option>
						<option value="direct-team">
							{t("jobs.admin.edit.directTeam")}
						</option>
						<option value="works-there">
							{t("jobs.admin.edit.worksThere")}
						</option>
						<option value="other">{t("jobs.admin.edit.other")}</option>
					</Select>

					<Input
						name="expiresAt"
						label={t("jobs.admin.edit.expiresOn")}
						type="date"
						required
						value={job.expiresAt.slice(0, 10)}
					/>

					<Select
						name="status"
						label={t("jobs.admin.edit.status")}
						value={job.status}
					>
						<option value="pending">
							{t("jobs.admin.edit.pendingReview")}
						</option>
						<option value="approved">{t("jobs.admin.edit.approved")}</option>
					</Select>

					{updateAction.value?.failed && (
						<div class="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-sm">
							{t("jobs.admin.edit.failedToUpdateJobPlease")}
						</div>
					)}

					<div class="flex gap-4">
						<Button type="submit">{t("jobs.admin.edit.saveChanges")}</Button>
						<Button href={`${adminBase}/jobs`} variant="secondary">
							{t("jobs.admin.edit.cancel")}
						</Button>
					</div>
				</form>
			</div>
		</div>
	);
});
