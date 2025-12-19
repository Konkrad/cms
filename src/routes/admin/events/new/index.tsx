import { component$, useSignal } from "@builder.io/qwik";
import { Form, routeAction$, z, zod$ } from "@builder.io/qwik-city";
import { Button } from "~/components/ui/Button";
import { Input } from "~/components/ui/Input";
import { Select } from "~/components/ui/Select";
import { TextArea } from "~/components/ui/TextArea";
import { eventsService } from "~/services/events.service";

const eventSchema = z.object({
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
	onlineUrl: z.string().optional(),
});

export const useCreateEvent = routeAction$(async (data, event) => {
	try {
		const session = await event.sharedMap.get("session");
		if (!session?.user?.id) {
			return {
				success: false,
				error: "Not authenticated",
			};
		}

		await eventsService.create({
			title: data.title,
			body: data.body,
			startDate: data.startDate,
			endDate: data.endDate,
			locationType: data.locationType,
			address: data.address || null,
			city: data.city || null,
			country: data.country || null,
			latitude: data.latitude ? parseFloat(data.latitude) : null,
			longitude: data.longitude ? parseFloat(data.longitude) : null,
			onlineUrl: data.onlineUrl || null,
			userId: session.user.id,
		});

		throw event.redirect(303, "/admin/events");
	} catch (error: any) {
		if (error.status === 303) throw error;
		return {
			success: false,
			error: error.message || "Failed to create event",
		};
	}
}, zod$(eventSchema));

export default component$(() => {
	const createEventAction = useCreateEvent();
	const isSubmitting = useSignal(false);

	return (
		<div>
			<div class="flex items-center justify-between mb-6">
				<h2 class="text-2xl font-bold text-gray-800">Create New Event</h2>
				<a href="/admin/events">
					<Button variant="secondary">Back to Events</Button>
				</a>
			</div>

			<div class="bg-white rounded-lg shadow p-6">
				<Form action={createEventAction} class="space-y-6">
					<Input
						name="title"
						label="Title"
						placeholder="Enter event title"
						required
					/>

					<TextArea
						name="body"
						label="Description"
						placeholder="Describe your event..."
						rows={4}
						required
					/>

					<div class="grid grid-cols-2 gap-4">
						<Input
							name="startDate"
							label="Start Date & Time"
							type="datetime-local"
							required
						/>
						<Input
							name="endDate"
							label="End Date & Time"
							type="datetime-local"
							required
						/>
					</div>

					<Select name="locationType" label="Location Type" required>
						<option value="in_person">In Person</option>
						<option value="online">Online</option>
						<option value="hybrid">Hybrid</option>
					</Select>

					<Input
						name="address"
						label="Address (for in-person events)"
						placeholder="Enter physical address"
					/>

					<Input
						name="onlineUrl"
						label="Online URL (for online events)"
						placeholder="https://zoom.us/..."
					/>

					<div class="grid grid-cols-2 gap-4">
						<Input name="city" label="City" placeholder="City" />
						<Input name="country" label="Country" placeholder="Country" />
					</div>

					<div class="grid grid-cols-2 gap-4">
						<Input
							name="latitude"
							label="Latitude"
							type="number"
							step="any"
							placeholder="0.0"
						/>
						<Input
							name="longitude"
							label="Longitude"
							type="number"
							step="any"
							placeholder="0.0"
						/>
					</div>

					{createEventAction.value?.error && (
						<div class="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
							{createEventAction.value.error}
						</div>
					)}

					<div class="flex gap-4">
						<Button type="submit" disabled={isSubmitting.value}>
							{isSubmitting.value ? "Creating..." : "Create Event"}
						</Button>
						<a href="/admin/events">
							<Button variant="secondary">Cancel</Button>
						</a>
					</div>
				</Form>
			</div>
		</div>
	);
});
