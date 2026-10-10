import { component$, useComputed$, useSignal, useTask$ } from "@qwik.dev/core";
import { Form, routeAction$, useLocation, z, zod$ } from "@qwik.dev/router";
import {
	AddressAutocomplete,
	Button,
	Input,
	Select,
	SmartDatePicker,
	TextArea,
} from "~/ui";
import { eventsService } from "../services/events";
import { requireAdminEvent } from "./auth";
import type { AdminEventDetailsData } from "./details-data";

const eventSchema = z
	.object({
		title: z.string().min(1, "Title is required"),
		body: z.string().min(1, "Description is required"),
		startDate: z.string().min(1, "Start date is required"),
		endDate: z.string().min(1, "End date is required"),
		locationType: z.enum(["online", "in_person", "hybrid"]),
		address: z.string().optional(),
		city: z.string().optional(),
		country: z.string().optional(),
		latitude: z.string().optional(),
		longitude: z.string().optional(),
		onlineUrl: z.string().url("Please enter a valid URL").optional(),
	})
	.superRefine((data, ctx) => {
		// Validate address is provided for in_person or hybrid events
		if (
			(data.locationType === "in_person" || data.locationType === "hybrid") &&
			!data.address
		) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				message: "Address is required for in-person and hybrid events",
				path: ["address"],
			});
		}

		// Validate online URL is provided for online or hybrid events
		if (
			(data.locationType === "online" || data.locationType === "hybrid") &&
			!data.onlineUrl
		) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				message: "Online URL is required for online and hybrid events",
				path: ["onlineUrl"],
			});
		}
	});

export const useUpdateEventDetails = routeAction$(async (data, event) => {
	await requireAdminEvent(event);
	const eventId = event.params.id;

	await eventsService.update(eventId, {
		title: data.title,
		body: data.body,
		startDate: new Date(data.startDate).toISOString(),
		endDate: new Date(data.endDate).toISOString(),
		locationType: data.locationType,
		address: data.address || null,
		city: data.city || null,
		country: data.country || null,
		latitude: data.latitude || null,
		longitude: data.longitude || null,
		onlineUrl: data.onlineUrl || null,
	} as any);

	return {
		success: true,
	};
}, zod$(eventSchema));

type Props = { event: AdminEventDetailsData };

export const AdminEventDetails = component$<Props>(({ event }) => {
	const updateEventAction = useUpdateEventDetails();

	// Compute the current admin context (global or group) so links can be context-aware
	const location = useLocation();
	const pathParts = location.url.pathname.split("/");
	const groupSlug = pathParts[2] || "global";
	const eventsBase = `/admin/${groupSlug}/events`;

	const isSubmitting = useSignal(false);
	const locationType = useSignal<"online" | "in_person" | "hybrid">(
		event.locationType as "online" | "in_person" | "hybrid",
	);

	// Geocoding state
	const latitude = useSignal(event.latitude?.toString() || "");
	const longitude = useSignal(event.longitude?.toString() || "");
	const city = useSignal(event.city || "");
	const country = useSignal(event.country || "");

	// Update location type when event data changes
	useTask$(({ track }) => {
		track(() => event);
		locationType.value = event.locationType as
			| "online"
			| "in_person"
			| "hybrid";
	});

	// Computed visibility flags
	const showAddress = useComputed$(() => {
		return (
			locationType.value === "in_person" || locationType.value === "hybrid"
		);
	});

	const showOnlineUrl = useComputed$(() => {
		return locationType.value === "online" || locationType.value === "hybrid";
	});

	const formatDatetimeLocal = (isoString: string) => {
		if (!isoString) return "";
		return isoString.slice(0, 16);
	};

	return (
		<div>
			<div class="flex items-center justify-between mb-6">
				<h2 class="text-2xl font-bold text-gray-800">Edit Event</h2>
				<Button href={eventsBase} variant="secondary">
					Back to Events
				</Button>
			</div>

			<div class="bg-white rounded-lg shadow-sm p-6">
				<Form action={updateEventAction} class="space-y-6">
					<Input
						name="title"
						label="Title"
						value={event.title}
						placeholder="Enter event title"
						required
					/>

					<TextArea
						name="body"
						label="Description"
						value={event.body}
						placeholder="Describe your event..."
						rows={4}
						required
					/>

					<SmartDatePicker
						startDateName="startDate"
						endDateName="endDate"
						label="Date & Time"
						required
						startValue={event.startDate}
						endValue={event.endDate}
					/>

					<Select
						name="locationType"
						label="Location Type"
						value={event.locationType}
						required
						onChange$={(e) => {
							locationType.value = (e.target as HTMLSelectElement).value as any;
						}}
					>
						<option value="in_person">In Person</option>
						<option value="online">Online</option>
						<option value="hybrid">Hybrid</option>
					</Select>

					{showAddress.value && (
						<AddressAutocomplete
							name="address"
							label="Address"
							placeholder="Start typing an address..."
							required={locationType.value !== "online"}
							value={event.address || ""}
							latitudeSignal={latitude}
							longitudeSignal={longitude}
							citySignal={city}
							countrySignal={country}
						/>
					)}

					{showOnlineUrl.value && (
						<Input
							name="onlineUrl"
							label="Online URL"
							type="url"
							value={event.onlineUrl || ""}
							placeholder="https://zoom.us/j/123456789"
							required={locationType.value !== "in_person"}
						/>
					)}

					{updateEventAction.value?.fieldErrors && (
						<div class="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-sm">
							{Object.entries(updateEventAction.value.fieldErrors).map(
								([field, errors]) => (
									<div key={field}>
										<strong>{field}:</strong>{" "}
										{Array.isArray(errors) ? errors.join(", ") : errors}
									</div>
								),
							)}
						</div>
					)}

					{updateEventAction.value?.formErrors && (
						<div class="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-sm">
							{updateEventAction.value.formErrors.join(", ")}
						</div>
					)}

					{updateEventAction.value?.success && (
						<div class="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-sm">
							Event updated successfully!
						</div>
					)}

					<div class="flex gap-4">
						<Button type="submit" disabled={isSubmitting.value}>
							{isSubmitting.value ? "Saving..." : "Save Changes"}
						</Button>
						<Button href={eventsBase} variant="secondary">
							Cancel
						</Button>
					</div>
				</Form>
			</div>
		</div>
	);
});
