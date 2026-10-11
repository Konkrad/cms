import { $, component$, useSignal } from "@qwik.dev/core";
import { routeAction$, z, zod$ } from "@qwik.dev/router";
import { allowedVisibilities, requireModuleAdmin } from "~/core";
import {
	AddressAutocomplete,
	Button,
	ImageUploader,
	Input,
	Select,
	SmartDatePicker,
	TextArea,
	VISIBILITIES,
	VisibilitySelector,
} from "~/core/ui";
import { eventsService } from "../services/events";
import type { NewEventContext } from "./new-data";

const eventSchema = z.object({
	title: z.string().min(1, "Title is required"),
	body: z.string().min(1, "Description is required"),
	startDate: z.string().min(1, "Start time is required"),
	endDate: z.string().min(1, "End time is required"),
	address: z.string().optional(),
	city: z.string().optional(),
	country: z.string().optional(),
	latitude: z.string().optional(),
	longitude: z.string().optional(),
	locationType: z.enum(["in_person", "online", "hybrid"]),
	onlineUrl: z.string().url("Invalid URL").optional().or(z.literal("")),
	visibility: z.enum(VISIBILITIES),
	image1: z.string().optional(),
	image2: z.string().optional(),
});

export const useCreateEvent = routeAction$(async (data, event) => {
	const { user, isRoot, scope, adminBase } = await requireModuleAdmin(event, {
		module: "events",
		scope: "any",
	});

	if (!(await allowedVisibilities(user, scope.id)).includes(data.visibility)) {
		return { success: false, error: "You cannot publish with this visibility" };
	}

	if (data.locationType !== "online" && !data.address) {
		return {
			success: false,
			error: "Location is required for in-person and hybrid events",
		};
	}

	await eventsService.create({
		title: data.title,
		body: data.body,
		startDate: new Date(data.startDate).toISOString(),
		endDate: new Date(data.endDate).toISOString(),
		address: data.address || null,
		city: data.city || null,
		country: data.country || null,
		latitude: data.latitude || null,
		longitude: data.longitude || null,
		locationType: data.locationType,
		onlineUrl: data.onlineUrl || null,
		visibility: data.visibility,
		scopeId: scope.id,
		userId: user.id,
		image1: data.image1 || null,
		image2: data.image2 || null,
	});

	throw event.redirect(303, `${adminBase}/events`);
}, zod$(eventSchema));

type Props = { groupContext: NewEventContext };

export const AdminEventNew = component$<Props>(({ groupContext }) => {
	const createEventAction = useCreateEvent();
	const isSubmitting = useSignal(false);
	const locationType = useSignal("in_person");
	const latitude = useSignal("");
	const longitude = useSignal("");
	const city = useSignal("");
	const country = useSignal("");

	const triggerUpload = useSignal(false);
	const successCount = useSignal(0);

	const handleSubmit = $(() => {
		console.log("[events/new] handleSubmit — setting triggerUpload=true");
		isSubmitting.value = true;
		triggerUpload.value = true;
	});

	const checkAndSubmit = $(() => {
		successCount.value++;
		console.log(
			`[events/new] checkAndSubmit — successCount=${successCount.value}`,
		);
		// We have 2 uploaders
		if (successCount.value === 2) {
			const form = document.querySelector("form");
			console.log("[events/new] submitting form", form);
			if (form) {
				createEventAction.submit(new FormData(form));
			}
		}
	});

	return (
		<div>
			<div class="flex items-center justify-between mb-6">
				<h2 class="text-2xl font-bold text-gray-800">Create New Event</h2>
				<Button href={`${groupContext.adminBase}/events`} variant="secondary">
					Back to Events
				</Button>
			</div>

			<div class="bg-white rounded-lg shadow-sm p-6">
				<form preventdefault:submit onSubmit$={handleSubmit} class="space-y-6">
					<Input
						name="title"
						label="Title"
						placeholder="e.g. Monthly Community Meetup"
						required
					/>
					<TextArea
						name="body"
						label="Description"
						placeholder="Describe the event..."
						required
					/>

					<SmartDatePicker
						startDateName="startDate"
						endDateName="endDate"
						label="Date & Time"
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
						{locationType.value !== "online" && (
							<AddressAutocomplete
								name="address"
								label="Location/Address"
								placeholder="Start typing an address..."
								required={locationType.value !== "online"}
								value=""
								latitudeSignal={latitude}
								longitudeSignal={longitude}
								citySignal={city}
								countrySignal={country}
							/>
						)}
					</div>

					{(locationType.value === "online" ||
						locationType.value === "hybrid") && (
						<Input
							name="onlineUrl"
							label="Online Meeting URL"
							placeholder="https://zoom.us/j/..."
							required
						/>
					)}

					<VisibilitySelector
						name="visibility"
						value={groupContext.visibilities[0]}
						options={groupContext.visibilities}
					/>

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
							/>
						</div>
					</div>

					<div class="flex gap-4">
						<Button type="submit" disabled={isSubmitting.value}>
							{isSubmitting.value ? "Creating..." : "Create Event"}
						</Button>
						<Button
							href={`${groupContext.adminBase}/events`}
							variant="secondary"
						>
							Cancel
						</Button>
					</div>
				</form>
			</div>
		</div>
	);
});
