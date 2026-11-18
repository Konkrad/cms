import { $, component$, useSignal } from "@qwik.dev/core";
import { routeAction$, z, zod$ } from "@qwik.dev/router";
import { allowedVisibilities, reviews } from "~/core";
import {
	Button,
	ImageUploader,
	Input,
	Select,
	SmartDatePicker,
	TextArea,
	t,
	VISIBILITIES,
	VisibilitySelector,
} from "~/core/ui";
import { eventsService } from "../services/events";
import type { AdminEventEditData } from "./edit-data";
import { requireAdminEvent } from "./event-guards";
import type { NewEventContext } from "./new-data";

const editEventSchema = z.object({
	id: z.string(),
	title: z.string().min(1, t("events.admin.edit.titleIsRequired")),
	body: z.string().min(1, t("events.admin.edit.descriptionIsRequired")),
	startDate: z.string().min(1, t("events.admin.edit.startDateIsRequired")),
	endDate: z.string().min(1, t("events.admin.edit.endDateIsRequired")),
	address: z.string().min(1, t("events.admin.edit.locationIsRequired")),
	locationType: z.enum(["in_person", "online", "hybrid"]),
	onlineUrl: z
		.string()
		.url(t("events.admin.edit.invalidUrl"))
		.optional()
		.or(z.literal("")),
	visibility: z.enum(VISIBILITIES),
	image1: z.string().optional(),
	image2: z.string().optional(),
});

export const useEditEvent = routeAction$(async (data, event) => {
	// Scope check on the event in the URL; the id in the form body is not trusted.
	const groupContext = await requireAdminEvent(event);
	const eventId = event.params.id;
	const allowed = await allowedVisibilities(
		groupContext.user,
		groupContext.scope.id,
	);
	// Keeping the current visibility is always allowed (an approved public event stays public).
	if (
		data.visibility !== groupContext.event.visibility &&
		!allowed.includes(data.visibility)
	) {
		return {
			success: false,
			error: t("events.admin.edit.youCannotPublishWithThis"),
		};
	}

	try {
		await eventsService.update(eventId, {
			title: data.title,
			body: data.body,
			startDate: new Date(data.startDate).toISOString(),
			endDate: new Date(data.endDate).toISOString(),
			address: data.address,
			locationType: data.locationType,
			onlineUrl: data.onlineUrl || null,
			visibility: data.visibility,
			image1: data.image1 || null,
			image2: data.image2 || null,
		});

		// A published event made public that was never approved goes through review like a
		// new one (spec 5.2): back to draft, then its proposal on the Review tab.
		const before = groupContext.event;
		if (
			before.status === "published" &&
			before.visibility !== "public" &&
			data.visibility === "public" &&
			(await reviews.isRequired(
				{ userId: groupContext.user.id },
				`events:event:${eventId}`,
			))
		) {
			await eventsService.setStatus(eventId, "draft");
			throw event.redirect(
				303,
				`${groupContext.adminBase}/events/${eventId}/review`,
			);
		}

		throw event.redirect(303, `${groupContext.adminBase}/events`);
	} catch (error: any) {
		if (error?.status === 303) throw error;
		return {
			success: false,
			error: error?.message || t("events.admin.edit.failedToUpdateEvent"),
		};
	}
}, zod$(editEventSchema));

type Props = { groupContext: NewEventContext; eventData: AdminEventEditData };

export const AdminEventEdit = component$<Props>(
	({ groupContext, eventData }) => {
		const updateEventAction = useEditEvent();
		const isSubmitting = useSignal(false);
		const locationType = useSignal(eventData.locationType);

		const triggerUpload = useSignal(false);
		const successCount = useSignal(0);
		const showImage1Uploader = useSignal(!eventData.image1);
		const showImage2Uploader = useSignal(!eventData.image2);

		const handleSubmit = $(() => {
			isSubmitting.value = true;
			triggerUpload.value = true;
		});

		const checkAndSubmit = $(() => {
			successCount.value++;
			// We have 2 uploaders
			if (successCount.value === 2) {
				const form = document.querySelector("form");
				if (form) {
					updateEventAction.submit(new FormData(form));
				}
			}
		});

		return (
			<div>
				<div class="flex items-center justify-between mb-6">
					<h2 class="text-2xl font-bold text-gray-800">
						{t("events.admin.edit.editEvent")}
					</h2>
					<Button href={`${groupContext.adminBase}/events`} variant="secondary">
						{t("events.admin.edit.backToEvents")}
					</Button>
				</div>

				<div class="bg-white rounded-lg shadow-sm p-6">
					<form
						preventdefault:submit
						onSubmit$={handleSubmit}
						class="space-y-6"
					>
						<input type="hidden" name="id" value={eventData.id} />
						<Input
							name="title"
							label={t("events.admin.edit.title")}
							value={eventData.title}
							required
						/>
						<TextArea
							name="body"
							label={t("events.admin.edit.description")}
							value={eventData.body}
							required
						/>

						<SmartDatePicker
							startDateName="startDate"
							endDateName="endDate"
							label={t("events.admin.edit.dateTime")}
							startValue={eventData.startDate}
							endValue={eventData.endDate}
							required
						/>

						<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
							<Select
								name="locationType"
								label={t("events.admin.edit.locationType")}
								value={locationType.value}
								onChange$={(e) => {
									locationType.value = (e.target as HTMLSelectElement).value;
								}}
							>
								<option value="in_person">
									{t("events.admin.edit.inPerson")}
								</option>
								<option value="online">{t("events.admin.edit.online")}</option>
								<option value="hybrid">{t("events.admin.edit.hybrid")}</option>
							</Select>
							<Input
								name="address"
								label={t("events.admin.edit.locationAddress")}
								value={eventData.address || ""}
								required
							/>
						</div>

						{(locationType.value === "online" ||
							locationType.value === "hybrid") && (
							<Input
								name="onlineUrl"
								label={t("events.admin.edit.onlineMeetingUrl")}
								value={eventData.onlineUrl || ""}
								required
							/>
						)}

						<VisibilitySelector
							name="visibility"
							value={eventData.visibility}
							options={VISIBILITIES.filter(
								(v) =>
									groupContext.visibilities.includes(v) ||
									v === eventData.visibility,
							)}
						/>

						<hr class="border-gray-200" />
						<p class="text-sm font-semibold text-gray-700">
							{t("events.admin.edit.eventPageImages")}
						</p>

						<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
							<div>
								<p class="text-sm font-medium text-gray-700 mb-1">
									{t("events.admin.edit.imageLeftSquare")}
								</p>
								<ImageUploader
									name="image1"
									path="public/events"
									triggerSignal={triggerUpload}
									aspectRatio="1/1"
									crop
									cropAspectRatio="1/1"
									onSettled$={checkAndSubmit}
									currentUrl={eventData.image1Url || undefined}
									currentValue={eventData.image1 || undefined}
								/>
							</div>
							<div>
								<p class="text-sm font-medium text-gray-700 mb-1">
									{t("events.admin.edit.imageRightSquare")}
								</p>
								<ImageUploader
									name="image2"
									path="public/events"
									triggerSignal={triggerUpload}
									aspectRatio="1/1"
									crop
									cropAspectRatio="1/1"
									onSettled$={checkAndSubmit}
									currentUrl={eventData.image2Url || undefined}
									currentValue={eventData.image2 || undefined}
								/>
							</div>
						</div>

						<div class="flex gap-4">
							<Button type="submit" disabled={isSubmitting.value}>
								{isSubmitting.value
									? t("events.admin.edit.savingChanges")
									: t("events.admin.edit.updateEvent")}
							</Button>
							<Button
								href={`${groupContext.adminBase}/events`}
								variant="secondary"
							>
								{t("events.admin.edit.cancel")}
							</Button>
						</div>
					</form>
				</div>
			</div>
		);
	},
);
