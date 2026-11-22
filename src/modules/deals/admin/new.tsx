import { $, component$, useSignal } from "@qwik.dev/core";
import { routeAction$, z, zod$ } from "@qwik.dev/router";
import { allowedVisibilities, requireModuleAdmin } from "~/core";
import { Button, ImageUploader, Input, TextArea, t } from "~/core/ui";
import { dealsService } from "../service";
import { AccessFields } from "./AccessFields";
import type { AdminDealNewData } from "./new-data";
import { StepsEditor } from "./StepsEditor";

export const useCreateDeal = routeAction$(
	async (data, event) => {
		const { user, scope, adminBase } = await requireModuleAdmin(event, {
			module: "deals",
		});
		if (!(await allowedVisibilities(user, scope.id)).includes(data.visibility))
			return { failed: true };

		const steps = JSON.parse(data.steps || "[]");

		await dealsService.create({
			name: data.name,
			description: data.description || null,
			logo: data.logo || null,
			validUntil: data.validUntil
				? new Date(data.validUntil).toISOString()
				: null,
			steps,
			visibility: data.visibility,
			requiredMembershipTier: data.requiredMembershipTier || null,
			scopeId: scope.id,
		} as any);

		throw event.redirect(303, `${adminBase}/deals`);
	},
	zod$({
		name: z.string().min(1, t("deals.admin.new.nameIsRequired")),
		description: z.string().optional(),
		logo: z.string().optional(),
		validUntil: z.string().optional(),
		visibility: z
			.enum(["public", "members", "representatives"])
			.default("public"),
		requiredMembershipTier: z.enum(["", "associated", "full"]).default(""),
		steps: z.string().default("[]"),
	}),
);

export const AdminDealNew = component$<{ data: AdminDealNewData }>(
	({ data }) => {
		const createAction = useCreateDeal();
		const isSubmitting = useSignal(false);
		const triggerUpload = useSignal(false);

		const handleSubmit = $(() => {
			isSubmitting.value = true;
			triggerUpload.value = true;
		});

		const onUploadSettled = $(() => {
			const form = document.querySelector("form") as HTMLFormElement | null;
			if (form) createAction.submit(new FormData(form));
		});

		return (
			<div>
				<div class="flex items-center justify-between mb-6">
					<h2 class="text-2xl font-bold text-gray-800">
						{t("deals.admin.new.addDeal")}
					</h2>
					<Button href={`${data.adminBase}/deals`} variant="secondary">
						{t("deals.admin.new.backToDeals")}
					</Button>
				</div>

				<div class="bg-white rounded-lg shadow-sm p-6">
					<form
						preventdefault:submit
						onSubmit$={handleSubmit}
						class="space-y-6"
					>
						<Input
							name="name"
							label={t("deals.admin.new.name")}
							required
							placeholder={t("deals.admin.new.dealName")}
						/>

						<TextArea
							name="description"
							label={t("deals.admin.new.description")}
							rows={3}
							placeholder={t("deals.admin.new.briefDescriptionOfThisDeal")}
						/>

						<div>
							<p class="text-sm font-medium text-gray-700 mb-1">
								{t("deals.admin.new.logoSvgOptional")}
							</p>
							<ImageUploader
								name="logo"
								path="public/deals/logos"
								pipeline="svg"
								triggerSignal={triggerUpload}
								onSettled$={onUploadSettled}
								aspectRatio="1/1"
							/>
						</div>

						<Input
							name="validUntil"
							label={t("deals.admin.new.validUntilOptional")}
							type="date"
						/>

						<AccessFields visibilities={data.visibilities} />

						<div>
							<p class="text-sm font-medium text-gray-700 mb-2">
								{t("deals.admin.new.steps")}
							</p>
							<StepsEditor />
						</div>

						{createAction.value?.failed && (
							<div class="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-sm">
								{t("deals.admin.new.failedToCreateDealPlease")}
							</div>
						)}

						<div class="flex gap-4">
							<Button type="submit" disabled={isSubmitting.value}>
								{isSubmitting.value
									? t("deals.admin.new.saving")
									: t("deals.admin.new.createDeal")}
							</Button>
						</div>
					</form>
				</div>
			</div>
		);
	},
);
