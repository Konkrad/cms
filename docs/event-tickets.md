# Ticket Sales Reasoning: Why Products Use Inventory Groups

This document explains the ticket-sales design choices.
## 1. Why Inventory Groups Exist

`inventory_groups` are not community groups. They are sales/capacity groups inside one event.

They exist to model a shared capacity pool across multiple products. Example:
- One inventory group: `Main Hall` with capacity 200.
- Two products in that same group: `Early Bird` and `Regular`.
- Selling either product consumes from the same 200 seats.

This avoids incorrect independent limits per product when the real-world constraint is shared seating/space.

## 2. Why Products Belong To Inventory Groups

Each product points to `inventoryGroupId` so checkout can enforce group-level rules consistently.

Reasoning from the original ticket-sales design:
- Multiple products must be able to share one capacity pool.
- Capacity checks must be done against the group total, not only a single product row.
- Group-level switches (like ticket generation and sales windows) should apply to all products in that group.

In short: product = what customer buys, inventory group = how availability is governed.

## 3. Why Products Also Keep Event Id

Products store both `eventId` and `inventoryGroupId`.

This is intentional for practical reasons:
- Fast event-scoped queries without always joining through inventory groups.
- Simpler admin/event screens and services that load all products for an event.
- Defensive consistency (product must belong to both event and group context).

So this is not accidental duplication; it supports query ergonomics and reliability.

## 4. Why Sales Dates Are On Inventory Groups

Sales windows (`salesStartDate`, `salesEndDate`) live on inventory groups so different ticket categories can open/close at different times for the same event.

Example:
- `Workshops` group opens early and closes sooner.
- `General Admission` group stays open longer.

This is more flexible than one global event-level sales window.

## 5. Why needsTicket Is On Inventory Groups

`needsTicket` is group-level to support mixed purchase types in a single event.

Possible scenario:
- Group A needs QR tickets (`needsTicket=true`) for entry control.
- Group B is a non-ticket add-on (`needsTicket=false`) but still sold and tracked in transactions.

This separation keeps payment accounting and ticket issuance from being forced to always move together.

## 6. What participantCapacity Means

`participantCapacity` is a product-level field that describes how many people one purchased unit can represent.

Example:
- Product: `Hotel Room Package`
- Quantity purchased: 1
- `participantCapacity`: 2
- Meaning: one purchased unit can carry details for two participants.

Important distinction:
- `quantity` = how many units were bought.
- `participantCapacity` = how many people each unit can cover.

Why this exists:
- Some products are shared packages (room, table, bundle) where one purchase can include multiple attendees.
- Organizers may need participant-level data (name/email/etc.) even when payment is done by a single buyer.

How it relates to inventory:
- Inventory and sold counts are still tracked per purchased unit (`quantity`).
- `participantCapacity` affects participant-data collection and attendee records, not how many product units were sold.

## 7. Capacity Enforcement Model (Current)

Availability is effectively filtered in layers:
1. Inventory group sales window and group remaining capacity.
2. Product-level remaining quantity (`maxQuantity` vs `soldQuantity`).
3. Validation before payment intent / fulfillment.

The core rationale is to prevent overselling both:
- shared capacity (group level), and
- product-specific quantity (product level).

## 8. Practical Consequence For Testing And Seeding

If you want to test realistic paid checkout behavior, include:
- at least one event with multiple inventory groups,
- multiple products per group,
- different prices and sold quantities,
- optional varied sales windows.

That is exactly why we added a dedicated multi-group seed event (`Checkout Matrix Demo Event`) in [scripts/seed.ts](scripts/seed.ts).

## 9. Common Misunderstanding To Avoid

There are two unrelated meanings of "group" in the system:
- Community group: ownership/visibility/governance (`events.groupId`).
- Inventory group: sales and capacity control (`products.inventoryGroupId`).

They solve different problems and should stay separate.
