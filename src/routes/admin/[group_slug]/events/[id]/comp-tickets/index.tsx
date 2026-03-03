import { component$, useSignal } from "@builder.io/qwik";
import {
  Form,
  routeAction$,
  routeLoader$,
  z,
  zod$,
} from "@builder.io/qwik-city";
import { Button } from "~/components/ui/Button";
import { Input } from "~/components/ui/Input";
import { Select } from "~/components/ui/Select";
import { ticketsService } from "~/services/tickets.service";
import { productsService } from "~/services/products.service";
import { eventsService } from "~/services/events.service";
import { usersService } from "~/services/users.service";

export const useEventData = routeLoader$(async (event) => {
  const { requireAdmin } = await import("~/utils/server-auth");
  await requireAdmin(event);

  const eventId = event.params.id;
  const eventData = await eventsService.getById(eventId);

  if (!eventData) {
    const groupSlug = event.params.group_slug || "global";
    throw event.redirect(303, `/admin/${groupSlug}/events`);
  }

  // Get all products for this event
  const allProducts = await productsService.getByEventId(eventId);

  return {
    event: eventData,
    products: allProducts,
  };
});

export const useIssueCompTicket = routeAction$(
  async (data, event) => {
    const { requireAdmin } = await import("~/utils/server-auth");
    await requireAdmin(event);

    const eventId = event.params.id;

    // Find or create user by email
    const existingUser = await usersService.getByEmail(data.email);
    let userId: string;

    if (existingUser) {
      userId = existingUser.id;
    } else {
      // Create a basic user account
      const newUser = await usersService.create({
        email: data.email,
        name: data.name,
        role: "user",
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

export default component$(() => {
  const data = useEventData();
  const issueCompTicket = useIssueCompTicket();
  const showForm = useSignal(false);

  return (
    <div class="container mx-auto p-6">
      <div class="mb-6">
        <h1 class="text-3xl font-bold mb-2">Issue Complimentary Tickets</h1>
        <p class="text-gray-600">Event: {data.value.event.title}</p>
      </div>

      {/* Success Message */}
      {issueCompTicket.value?.success && (
        <div class="mb-6 p-4 bg-green-100 border border-green-400 text-green-700 rounded">
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
        <div class="bg-white rounded-lg shadow p-6 mb-6">
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
              <label class="block text-sm font-medium text-gray-700">
                Product
              </label>
              <Select name="productId" required>
                <option value="">Select a product</option>
                {data.value.products.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.name} - €{product.price.toFixed(2)}
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
      <div class="bg-white rounded-lg shadow p-6">
        <h2 class="text-xl font-bold mb-4">Recent Complimentary Tickets</h2>
        <p class="text-gray-600">
          This feature will display recently issued comp tickets.
        </p>
      </div>
    </div>
  );
});
