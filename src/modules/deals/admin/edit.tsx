import { $, component$, useSignal } from "@qwik.dev/core";
import { routeAction$, z, zod$ } from "@qwik.dev/router";
import { format } from "date-fns";
import { requireModuleAdmin, requireWithinScope } from "~/core";
import { Button, ImageUploader, Input, TextArea } from "~/core/ui";
import { dealsService } from "../service";
import type { AdminDealData } from "./edit-data";
import { StepsEditor } from "./StepsEditor";

export const useUpdateDeal = routeAction$(
	async (data, event) => {
		const { scope, adminBase } = await requireModuleAdmin(event, {
			module: "deals",
		});
		await requireWithinScope(
			event,
			scope,
			await dealsService.getById(event.params.id),
		);

		const steps = JSON.parse(data.steps || "[]");

		await dealsService.update(event.params.id, {
			name: data.name,
			description: data.description || null,
			logo: data.logo || null,
			validUntil: data.validUntil
				? new Date(data.validUntil).toISOString()
				: null,
			steps,
		} as any);

		throw event.redirect(303, `${adminBase}/deals`);
	},
	zod$({
		name: z.string().min(1, "Name is required"),
		description: z.string().optional(),
		logo: z.string().optional(),
		validUntil: z.string().optional(),
		steps: z.string().default("[]"),
	}),
);

export const AdminDealEdit = component$<{ data: AdminDealData }>(
	({ data: loaded }) => {
		const updateAction = useUpdateDeal();
		const isSubmitting = useSignal(false);
		const triggerUpload = useSignal(false);
		const showLogoUploader = useSignal(!loaded.deal.logo);

		const handleSubmit = $(() => {
			isSubmitting.value = true;
			if (showLogoUploader.value) {
				triggerUpload.value = true;
			} else {
				const form = document.querySelector("form") as HTMLFormElement | null;
				if (form) updateAction.submit(new FormData(form));
			}
		});

		const onUploadSettled = $(() => {
			const form = document.querySelector("form") as HTMLFormElement | null;
			if (form) updateAction.submit(new FormData(form));
		});

		const deal = loaded.deal;
		const validUntilDate = deal.validUntil
			? format(new Date(deal.validUntil), "yyyy-MM-dd")
			: "";

		return (
			<div>
				<div class="flex items-center justify-between mb-6">
					<h2 class="text-2xl font-bold text-gray-800">Edit Deal</h2>
					<Button href={`${loaded.adminBase}/deals`} variant="secondary">
						Back to Deals
					</Button>
				</div>

				<div class="bg-white rounded-lg shadow-sm p-6">
					<form
						preventdefault:submit
						onSubmit$={handleSubmit}
						class="space-y-6"
					>
						<Input name="name" label="Name" required value={deal.name} />

						<TextArea
							name="description"
							label="Description"
							rows={3}
							value={deal.description ?? ""}
						/>

						<div>
							<p class="text-sm font-medium text-gray-700 mb-1">
								Logo (SVG, optional)
							</p>
							{!showLogoUploader.value && loaded.logoUrl ? (
								<div class="flex items-center gap-4">
									<img
										src={loaded.logoUrl}
										alt="Current logo"
										width={64}
										height={64}
										class="w-16 h-16 object-contain border border-gray-200 rounded-lg p-1"
									/>
									<button
										type="button"
										class="text-sm text-blue-600 hover:text-blue-800"
										onClick$={() => {
											showLogoUploader.value = true;
										}}
									>
										Replace logo
									</button>
									<input type="hidden" name="logo" value={deal.logo ?? ""} />
								</div>
							) : (
								<ImageUploader
									name="logo"
									path="public/deals/logos"
									pipeline="svg"
									triggerSignal={triggerUpload}
									onSettled$={onUploadSettled}
									aspectRatio="1/1"
								/>
							)}
						</div>

						<Input
							name="validUntil"
							label="Valid Until (optional)"
							type="date"
							value={validUntilDate}
						/>

						<div>
							<p class="text-sm font-medium text-gray-700 mb-2">Steps</p>
							<StepsEditor initialSteps={deal.steps ?? []} />
						</div>

						{updateAction.value?.failed && (
							<div class="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-sm">
								Failed to update deal. Please check the form.
							</div>
						)}

						<div class="flex gap-4">
							<Button type="submit" disabled={isSubmitting.value}>
								{isSubmitting.value ? "Saving…" : "Save Changes"}
							</Button>
						</div>
					</form>
				</div>
			</div>
		);
	},
);
