import { component$, useComputed$, useSignal, useTask$ } from "@qwik.dev/core";
import { Form, routeAction$, useLocation, z, zod$ } from "@qwik.dev/router";
import {
	AddressAutocomplete,
	Button,
	Input,
	Select,
	SmartDatePicker,
	TextArea,
	t,
} from "~/core/ui";
import { eventsService } from "../services/events";
import type { AdminEventDetailsData } from "./details-data";
import { requireAdminEvent } from "./event-guards";

const eventSchema = z
	.object({
		title: z.string().min(1, t("events.admin.details.titleIsRequired")),
		body: z.string().min(1, t("events.admin.details.descriptionIsRequired")),
		startDate: z.string().min(1, t("events.admin.details.startDateIsRequired")),
		endDate: z.string().min(1, t("events.admin.details.endDateIsRequired")),
		locationType: z.enum(["online", "in_person", "hybrid"]),
		address: z.string().optional(),
		city: z.string().optional(),
		country: z.string().optional(),
		latitude: z.string().optional(),
		longitude: z.string().optional(),
		onlineUrl: z
			.string()
			.url(t("events.admin.details.pleaseEnterAValidUrl"))
			.optional(),
	})
	.superRefine((data, ctx) => {
		// Validate address is provided for in_person or hybrid events
		if (
			(data.locationType === "in_person" || data.locationType === "hybrid") &&
			!data.address
		) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				message: t("events.admin.details.addressIsRequiredForIn"),
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
				message: t("events.admin.details.onlineUrlIsRequiredFor"),
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
	const scopeSegment = pathParts[2] || "root";
	const eventsBase = `/admin/${scopeSegment}/events`;

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
				<h2 class="text-2xl font-bold text-gray-800">
					{t("events.admin.details.editEvent")}
				</h2>
				<Button href={eventsBase} variant="secondary">
					{t("events.admin.details.backToEvents")}
				</Button>
			</div>

			<div class="bg-white rounded-lg shadow-sm p-6">
				<Form action={updateEventAction} class="space-y-6">
					<Input
						name="title"
						label={t("events.admin.details.title")}
						value={event.title}
						placeholder={t("events.admin.details.enterEventTitle")}
						required
					/>

					<TextArea
						name="body"
						label={t("events.admin.details.description")}
						value={event.body}
						placeholder={t("events.admin.details.describeYourEvent")}
						rows={4}
						required
					/>

					<SmartDatePicker
						startDateName="startDate"
						endDateName="endDate"
						label={t("events.admin.details.dateTime")}
						required
						startValue={event.startDate}
						endValue={event.endDate}
					/>

					<Select
						name="locationType"
						label={t("events.admin.details.locationType")}
						value={event.locationType}
						required
						onChange$={(e) => {
							locationType.value = (e.target as HTMLSelectElement).value as any;
						}}
					>
						<option value="in_person">
							{t("events.admin.details.inPerson")}
						</option>
						<option value="online">{t("events.admin.details.online")}</option>
						<option value="hybrid">{t("events.admin.details.hybrid")}</option>
					</Select>

					{showAddress.value && (
						<AddressAutocomplete
							name="address"
							label={t("events.admin.details.address")}
							placeholder={t("events.admin.details.startTypingAnAddress")}
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
							label={t("events.admin.details.onlineUrl")}
							type="url"
							value={event.onlineUrl || ""}
							placeholder={t("events.admin.details.httpsZoomUsJ123456789")}
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
							{t("events.admin.details.eventUpdatedSuccessfully")}
						</div>
					)}

					<div class="flex gap-4">
						<Button type="submit" disabled={isSubmitting.value}>
							{isSubmitting.value
								? t("events.admin.details.saving")
								: t("events.admin.details.saveChanges")}
						</Button>
						<Button href={eventsBase} variant="secondary">
							{t("events.admin.details.cancel")}
						</Button>
					</div>
				</Form>
			</div>
		</div>
	);
});
