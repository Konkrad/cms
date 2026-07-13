# Event & ticketing flow

End-to-end walkthrough of how an event goes from admin creation to a member
scanning into the venue, aimed at admins/local reps rather than engineers.

If you're modifying the checkout logic or the products/inventory-group
schema itself, read [Event CTA Flow](./event-flow.md) (exact CTA state
machine + payment flowcharts) and [Ticket Sales
Reasoning](./event-tickets.md) (why the data model looks the way it does)
instead — this doc intentionally stays at the "how do I use this" level.

## 1. Creating an event

An admin or local rep creates the base event under
`/admin/{group_slug}/events/new`: title, description, start/end date,
location type (in person / online / hybrid), address or online URL, and
visibility (global — listed platform-wide — or restricted to the one
group).

![Create event form](./images/admin-event-create.png)

## 2. Setting up tickets (inventory groups & products)

Pricing and capacity are configured separately, on the event's **Products**
tab, using two nested concepts:

- An **inventory group** is a capacity pool — a name, a `maxCapacity`, an
  optional sales-window (`salesStartDate`/`salesEndDate`), and a
  `needsTicket` flag. `needsTicket: true` means anything sold from this
  group generates a scannable QR ticket; `false` is for RSVP-only add-ons
  that don't need door check-in.
- A **product** lives inside an inventory group and is the thing a member
  actually buys: name, `price`, `maxQuantity` per purchase, and
  `participantCapacity` — how many named attendees one unit covers (e.g. a
  "Couple's Ticket" would have `participantCapacity: 2`).

![Inventory groups and products](./images/admin-event-inventory-products.png)

A €0 product works exactly the same way as a paid one — it still goes
through checkout and still produces a real, scannable ticket. This is
different from a plain RSVP (see below).

## 3. RSVP vs. paid/ticketed attendance — two separate systems

- **RSVP** (`participationService`) is a lightweight yes/no/maybe intent
  tracker, unrelated to money or capacity. It's what drives the simple
  "✓ Going" toggle on an event page when there's nothing to buy.
- **Tickets** always go through the checkout flow below, inventory
  tracking, and (for non-zero prices) Stripe — regardless of price. On a
  successful ticket purchase (including €0 ones), the buyer's RSVP status
  is automatically upgraded to "yes" (`participationService.autoUpgradeToYes`),
  so the two stay in sync without a member having to do both separately.

## 4. Member checkout — three steps

**Step 1 — select products.** Remaining capacity per product is computed
live from the inventory group's `maxCapacity` minus units already sold.

![Checkout step 1](./images/checkout-1-select-products.png)

**Step 2 — assign participants.** For each ticket unit, the buyer fills in
a name + email per seat (per the product's `participantCapacity`). The
buyer is always force-assigned to the first slot of the first ticket. If a
participant is an existing member, their email is resolved **server-side**
from their user ID — a client can never directly submit another member's
email address.

![Checkout step 2](./images/checkout-2-participants.png)

**Step 3 — payment.** Shows an order summary, then (if the event/user needs
them) food-preference and photo-consent steps, then payment. The total is
always recomputed server-side from the products' actual prices — never
trusted from the client. If the total is €0, tickets are created
immediately and Stripe is skipped entirely; otherwise a Stripe
`paymentIntent` is created (with participant data packed into Stripe
metadata, chunked to fit Stripe's per-field size limit).

![Checkout step 3](./images/checkout-3-payment.png)

## 5. What actually happens on a successful paid order

For a genuinely paid order, **ticket creation happens server-side via the
Stripe webhook** (`src/routes/api/webhooks/stripe/index.ts`), not directly
from the checkout request — the webhook verifies Stripe's signature, then
on `payment_intent.succeeded` creates the transaction, the tickets, the
participant records, generates each ticket's QR code, and fires off the
confirmation email, an iCal attachment, and a Telegram notification.

This means a purchase isn't "real" until the webhook fires — if you're
debugging a payment that seemingly succeeded on the client but produced no
ticket, check the webhook logs and `STRIPE_WEBHOOK_SECRET` configuration
first.

## 6. Tickets, QR codes, and check-in

Every ticket has a `qrCodeUuid` (rotatable). Members see their tickets,
grouped by event, at `/profile/tickets` (the "My Tickets" nav item — theme
component `QrTicketWall`).

At the door, an admin/local rep uses the event's **Scan** tab
(`admin/{group_slug}/events/[id]/scan`) — a camera-based scanner that reads
the QR payload, validates it belongs to this event, and marks it as
scanned. The **Attendance** view shows the full check-in report.

## 7. Issuing free tickets directly

The **Comp Tickets** tab (`admin/{group_slug}/events/[id]/comp-tickets`)
lets an admin issue a complimentary ticket straight to an email address,
bypassing checkout entirely — it finds-or-creates the user by email and
calls the same ticket-creation path a €0 checkout would use.
