import { $, component$, useSignal } from "@qwik.dev/core";
import { routeAction$, z, zod$ } from "@qwik.dev/router";
import {
	Button,
	ImageUploader,
	Input,
	Select,
	SmartDatePicker,
	TextArea,
	VisibilitySelector,
} from "~/core/ui";
import { eventsService } from "../services/events";
import type { AdminEventEditData } from "./edit-data";
import { requireAdminEvent } from "./event-guards";
import type { NewEventContext } from "./new-data";

const editEventSchema = z.object({
	id: z.string(),
	title: z.string().min(1, "Title is required"),
	body: z.string().min(1, "Description is required"),
	startDate: z.string().min(1, "Start date is required"),
	endDate: z.string().min(1, "End date is required"),
	address: z.string().min(1, "Location is required"),
	locationType: z.enum(["in_person", "online", "hybrid"]),
	onlineUrl: z.string().url("Invalid URL").optional().or(z.literal("")),
	visibility: z.enum(["global", "group-only"]).default("global"),
	image1: z.string().optional(),
	image2: z.string().optional(),
});

export const useEditEvent = routeAction$(async (data, event) => {
	// Scope check on the event in the URL; the id in the form body is not trusted.
	const groupContext = await requireAdminEvent(event);
	const eventId = event.params.id;

	try {
		await eventsService.update(eventId, {
			title: data.title,
			body: data.body,
			startDate: new Date(data.startDate).toISOString(),
			endDate: new Date(data.endDate).toISOString(),
			address: data.address,
			locationType: data.locationType,
			onlineUrl: data.onlineUrl || null,
			visibility: groupContext.isGlobal ? data.visibility : "group-only",
			image1: data.image1 || null,
			image2: data.image2 || null,
		});

		const redirectUrl = groupContext.isGlobal
			? "/admin/global/events"
			: `/admin/${groupContext.group.slug}/events`;
		throw event.redirect(303, redirectUrl);
	} catch (error: any) {
		if (error?.status === 303) throw error;
		return {
			success: false,
			error: error?.message || "Failed to update event",
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
					<h2 class="text-2xl font-bold text-gray-800">Edit Event</h2>
					<Button
						href={`/admin/${groupContext.isGlobal ? "global" : groupContext.group?.slug}/events`}
						variant="secondary"
					>
						Back to Events
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
							label="Title"
							value={eventData.title}
							required
						/>
						<TextArea
							name="body"
							label="Description"
							value={eventData.body}
							required
						/>

						<SmartDatePicker
							startDateName="startDate"
							endDateName="endDate"
							label="Date & Time"
							startValue={eventData.startDate}
							endValue={eventData.endDate}
							required
						/>

						<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
							<Select
								name="locationType"
								label="Location Type"
								value={locationType.value}
								onChange$={(e) => {
									locationType.value = (e.target as HTMLSelectElement).value;
								}}
							>
								<option value="in_person">In Person</option>
								<option value="online">Online</option>
								<option value="hybrid">Hybrid</option>
							</Select>
							<Input
								name="address"
								label="Location/Address"
								value={eventData.address || ""}
								required
							/>
						</div>

						{(locationType.value === "online" ||
							locationType.value === "hybrid") && (
							<Input
								name="onlineUrl"
								label="Online Meeting URL"
								value={eventData.onlineUrl || ""}
								required
							/>
						)}

						{!groupContext.isGlobal && (
							<VisibilitySelector
								name="visibility"
								value={eventData.visibility as any}
								isGroupContext={true}
							/>
						)}

						<hr class="border-gray-200" />
						<p class="text-sm font-semibold text-gray-700">Event Page Images</p>

						<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
							<div>
								<p class="text-sm font-medium text-gray-700 mb-1">
									Image Left (square)
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
									Image Right (square)
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
								{isSubmitting.value ? "Saving Changes..." : "Update Event"}
							</Button>
							<Button
								href={`/admin/${groupContext.isGlobal ? "global" : groupContext.group?.slug}/events`}
								variant="secondary"
							>
								Cancel
							</Button>
						</div>
					</form>
				</div>
			</div>
		);
	},
);
