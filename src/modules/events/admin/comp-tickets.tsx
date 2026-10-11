import { component$, useSignal } from "@qwik.dev/core";
import { Form, routeAction$, z, zod$ } from "@qwik.dev/router";
import { usersService } from "~/core";
import { Button, Input, Select } from "~/core/ui";
import { productsService } from "../services/products";
import { ticketsService } from "../services/tickets";
import type { AdminCompTicketsData } from "./comp-tickets-data";
import { requireCompTicketsAdmin } from "./event-guards";

export const useIssueCompTicket = routeAction$(
	async (data, event) => {
		await requireCompTicketsAdmin(event);

		const eventId = event.params.id;

		// The product must belong to this event: a ticket never crosses events.
		const product = await productsService.getById(data.productId);
		if (!product || product.eventId !== eventId) {
			return event.fail(400, { message: "Product not found for this event" });
		}

		// Find or create user by email
		const existingUser = await usersService.getByEmail(data.email);
		let userId: string;

		if (existingUser) {
			userId = existingUser.id;
		} else {
			// Create a basic user account (familyName is required by the schema)
			const newUser = await usersService.create({
				name: data.name,
				familyName: "",
			});
			userId = newUser.id;
		}

		// Create free ticket
		const ticket = await ticketsService.createFreeTicket({
			productId: data.productId,
			eventId,
			buyerId: userId,
		});

		return {
			success: true,
			ticketId: ticket.id,
			message: `Complimentary ticket issued to ${data.email}`,
		};
	},
	zod$({
		productId: z.string().uuid(),
		email: z.string().email("Invalid email address"),
		name: z.string().min(1, "Name is required"),
	}),
);

type Props = { data: AdminCompTicketsData };

export const AdminEventCompTickets = component$<Props>(({ data }) => {
	const issueCompTicket = useIssueCompTicket();
	const showForm = useSignal(false);

	return (
		<div class="container mx-auto p-6">
			<div class="mb-6">
				<h1 class="text-3xl font-bold mb-2">Issue Complimentary Tickets</h1>
				<p class="text-gray-600">Event: {data.event.title}</p>
			</div>

			{/* Success Message */}
			{issueCompTicket.value?.success && (
				<div class="mb-6 p-4 bg-green-100 border border-green-400 text-green-700 rounded-sm">
					{issueCompTicket.value.message}
				</div>
			)}

			{/* Issue Comp Ticket Button */}
			<div class="mb-6">
				<Button
					onClick$={() => {
						showForm.value = !showForm.value;
					}}
				>
					{showForm.value ? "Cancel" : "Issue Complimentary Ticket"}
				</Button>
			</div>

			{/* Comp Ticket Form */}
			{showForm.value && (
				<div class="bg-white rounded-lg shadow-sm p-6 mb-6">
					<h2 class="text-xl font-bold mb-4">Issue Comp Ticket</h2>
					<Form action={issueCompTicket} class="space-y-4">
						<Input
							name="name"
							label="Recipient Name"
							placeholder="John Doe"
							required
						/>

						<Input
							name="email"
							label="Recipient Email"
							type="email"
							placeholder="john@example.com"
							required
						/>

						<div class="space-y-2">
							<label
								for="f-productId"
								class="block text-sm font-medium text-gray-700"
							>
								Product
							</label>
							<Select id="f-productId" name="productId" required>
								<option value="">Select a product</option>
								{data.products.map((product) => (
									<option key={product.id} value={product.id}>
										{`${product.name} - €${product.price.toFixed(2)}`}
									</option>
								))}
							</Select>
						</div>

						<div class="flex gap-4">
							<Button type="submit">Issue Ticket</Button>
							<Button
								type="button"
								variant="secondary"
								onClick$={() => {
									showForm.value = false;
								}}
							>
								Cancel
							</Button>
						</div>
					</Form>
				</div>
			)}

			{/* Recent Comp Tickets List */}
			<div class="bg-white rounded-lg shadow-sm p-6">
				<h2 class="text-xl font-bold mb-4">Recent Complimentary Tickets</h2>
				<p class="text-gray-600">
					This feature will display recently issued comp tickets.
				</p>
			</div>
		</div>
	);
});
