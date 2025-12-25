# Feature Specification: Ticket Sales System

**Feature Branch**: `001-ticket-sales`  
**Created**: 2025-12-25  
**Status**: Draft  
**Input**: User description: "Create a comprehensive feature specification for a ticket sale system integrated into the event document type with multiple ticket types, Stripe payment processing, local inventory management, and ticket generation with QR codes"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Customer Purchases Tickets (Priority: P1)

A customer visits an event page, browses available ticket types, selects their desired tickets, completes payment via Stripe, and receives a confirmation email with their tickets including QR codes.

**Why this priority**: This is the core revenue-generating flow that delivers immediate business value. Without this, the entire ticket sales system has no purpose.

**Independent Test**: Can be fully tested by creating an event with products, purchasing tickets through the checkout flow, and verifying payment confirmation and email delivery. Delivers immediate value by enabling ticket sales.

**Acceptance Scenarios**:

1. **Given** an event with available tickets, **When** a customer clicks "Buy Tickets", **Then** they see a ticket selection page with available inventory groups and products
2. **Given** the customer is on the ticket selection page, **When** they select products and quantities within available limits, **Then** they can proceed to checkout
3. **Given** the customer is at checkout, **When** they complete payment via Stripe, **Then** inventory is decremented, a transaction record is created, and they receive a confirmation email with QR codes for tickets
4. **Given** payment fails, **When** Stripe returns an error, **Then** the customer sees a failure page and no inventory is decremented

---

### User Story 2 - Admin Creates Event Products (Priority: P1)

An event administrator accesses the event management area, navigates to the Products tab, creates inventory groups with capacity limits, and adds ticket products with pricing, images, and features.

**Why this priority**: Without products, customers have nothing to purchase. This is a prerequisite for the purchase flow and must be completed first.

**Independent Test**: Can be fully tested by logging in as admin, creating an event, defining inventory groups with capacities, adding products with all required fields, and verifying products are stored correctly. Delivers value by enabling event setup.

**Acceptance Scenarios**:

1. **Given** an admin is viewing an event, **When** they click the edit button, **Then** they see a multi-tab interface with Details, Products, Transactions, and Tickets tabs
2. **Given** the admin is on the Products tab, **When** they create an inventory group with a name, capacity, and needsTicket flag, **Then** the group is saved and available for product assignment
3. **Given** an inventory group exists, **When** the admin creates a product with name, price, inventory group, max quantity, features, and image, **Then** the product is saved locally and synchronized to Stripe
4. **Given** a product image is uploaded, **When** the admin uses the image picker, **Then** they can crop the image before upload

---

### User Story 3 - Staff Scans Tickets at Event (Priority: P2)

Event staff accesses the Tickets tab, scans customer QR codes using a device camera, and marks tickets as scanned to prevent duplicate entry.

**Why this priority**: Essential for event security and preventing fraud, but the system can function for sales without immediate scanning capability. Can be added after basic sales are working.

**Independent Test**: Can be fully tested by creating test tickets, accessing the Tickets tab, scanning QR codes, and verifying scanned status is recorded. Delivers value by enabling access control at events.

**Acceptance Scenarios**:

1. **Given** a staff member is on the Tickets tab, **When** they scan a ticket's QR code, **Then** the ticket is marked as scanned with a timestamp
2. **Given** a ticket has already been scanned, **When** staff attempts to scan it again, **Then** they see a warning that it was already scanned
3. **Given** a staff member needs to find a specific ticket, **When** they search by buyer name, **Then** they see all matching tickets with their scan status
4. **Given** a customer doesn't have their QR code available, **When** staff searches by name and manually verifies identity, **Then** staff can manually mark the ticket as scanned

---

### User Story 4 - Customer Views Purchase History (Priority: P3)

A customer logs into their dashboard and views a list of all their past transactions and current tickets with QR codes.

**Why this priority**: Improves user experience and reduces support burden, but customers receive tickets via email immediately after purchase. This is a convenience feature that can be added later.

**Independent Test**: Can be fully tested by logging in as a customer who has made purchases, navigating to the dashboard, and verifying all transactions and tickets are displayed correctly. Delivers value by providing self-service access to purchase history.

**Acceptance Scenarios**:

1. **Given** a logged-in customer has purchased tickets, **When** they navigate to their dashboard, **Then** they see a list of all their transactions
2. **Given** the customer is viewing their dashboard, **When** they look at their tickets section, **Then** they see all tickets with QR codes for upcoming events
3. **Given** a customer needs to access their tickets, **When** they view a ticket, **Then** they can display or download the QR code

---

### User Story 5 - Admin Reviews Transactions (Priority: P3)

An event administrator views the Transactions tab to see all payments received for an event, including amounts, fees, and purchased products.

**Why this priority**: Important for financial tracking and reporting, but not required for basic sales functionality. Administrators can view this data in Stripe dashboard initially.

**Independent Test**: Can be fully tested by creating test transactions and viewing them in the Transactions tab with complete payment details. Delivers value by centralizing financial reporting.

**Acceptance Scenarios**:

1. **Given** an admin is viewing an event, **When** they navigate to the Transactions tab, **Then** they see all completed payments with total amount and fees
2. **Given** the admin is viewing a transaction, **When** they expand transaction details, **Then** they see the list of products purchased in that transaction
3. **Given** multiple transactions exist, **When** the admin views the list, **Then** transactions are sorted by date with most recent first

---

### Edge Cases

- What happens when inventory reaches zero while a customer is in checkout? (System should check inventory again before completing payment)
- What happens when Stripe webhook is delayed or fails? (Transaction may show as pending until webhook is received)
- What happens when multiple products share the same inventory group and combined purchases would exceed capacity? (System should validate total across all products in the group)
- What happens when a product has maxQuantity=0? (Customer should be able to select unlimited quantity up to remaining inventory)
- What happens when inventoryGroup.needsTicket=false? (No tickets or QR codes are generated, only transaction record)
- What happens when a customer attempts to purchase after inventory sells out between page load and checkout? (Validation should fail with clear error message)
- What happens when email delivery fails after successful payment? (Transaction completes, customer can access tickets via dashboard, system should retry email)
- What happens when a QR code is scanned for a ticket that doesn't exist? (Scanner should show "Invalid ticket" error)
- What happens when two staff members scan the same ticket simultaneously? (First scan succeeds, second scan shows already scanned warning)
- What happens when customer closes browser during Stripe payment? (Webhook completes transaction if payment succeeded, otherwise checkout session expires)

## Requirements *(mandatory)*

### Functional Requirements

#### Inventory Management
- **FR-001**: System MUST allow admins to create inventory groups with name, maximum capacity, and needsTicket flag
- **FR-002**: System MUST allow multiple products to share the same inventory group
- **FR-003**: System MUST track sold quantity across all products in an inventory group
- **FR-004**: System MUST prevent purchases when inventory group capacity is reached
- **FR-005**: System MUST validate inventory availability before completing payment

#### Product Management
- **FR-006**: System MUST allow admins to create products with name, event reference, inventory group reference, price in EUR, max quantity per transaction, feature list, and image
- **FR-007**: System MUST support max quantity of 0 to represent unlimited per-transaction purchases (still limited by inventory)
- **FR-008**: System MUST upload product images to existing upload endpoint
- **FR-009**: System MUST provide image cropping before upload
- **FR-010**: System MUST create corresponding Stripe products for each local product
- **FR-011**: System MUST store Stripe product ID with local product record

#### Payment Processing
- **FR-012**: System MUST display available products grouped by inventory group with remaining capacity
- **FR-013**: System MUST enforce product max quantity limits during selection
- **FR-014**: System MUST enforce remaining inventory limits during selection
- **FR-015**: System MUST display Stripe payment methods at checkout
- **FR-016**: System MUST process payments through Stripe embedded components
- **FR-017**: System MUST display confirmation page on successful payment
- **FR-018**: System MUST display failure page on payment failure

#### Transaction Recording
- **FR-019**: System MUST record transaction details including total amount, transaction fee, and purchased products
- **FR-020**: System MUST process Stripe `transaction.completed` webhook events
- **FR-021**: System MUST update inventory counts upon successful payment
- **FR-022**: System MUST allow admins to view all transactions for an event
- **FR-023**: System MUST display transaction details including amount, fee, and product list

#### Ticket Generation
- **FR-024**: System MUST generate tickets only when inventoryGroup.needsTicket equals true
- **FR-025**: System MUST generate one ticket per product unit purchased (10 products = 10 tickets)
- **FR-026**: System MUST assign each ticket a unique database identifier
- **FR-027**: System MUST assign each ticket a separate unique identifier for QR code
- **FR-028**: System MUST store scannedAt timestamp for each ticket (null by default)
- **FR-029**: System MUST provide publicly accessible endpoint `/tickets/[ticket_id]/qr_code.png` that generates QR code on-the-fly
- **FR-030**: System MUST encode QR code separate UUID in QR code image (not database ID)

#### Ticket Scanning
- **FR-031**: System MUST allow event staff to scan ticket QR codes
- **FR-032**: System MUST mark tickets as scanned by setting scannedAt timestamp
- **FR-033**: System MUST prevent duplicate scanning by showing warning for already-scanned tickets
- **FR-034**: System MUST allow staff to search tickets by buyer name
- **FR-035**: System MUST allow staff to manually mark tickets as scanned
- **FR-036**: System MUST display all tickets for an event with scan status

#### Email Notifications
- **FR-037**: System MUST send confirmation email upon successful payment
- **FR-038**: Confirmation email MUST include thank you message, purchased products list, and ticket QR codes (if needsTicket=true)
- **FR-039**: Confirmation email MUST include iCal attachment with event details
- **FR-040**: System MUST send Telegram notification with transaction amount and product count to configured channel

#### User Dashboard
- **FR-041**: System MUST provide user dashboard page listing personal transactions
- **FR-042**: System MUST display personal tickets with QR codes on user dashboard
- **FR-043**: Users MUST be able to access their tickets without needing confirmation email

#### Admin Interface
- **FR-044**: System MUST provide multi-tab interface for event management with Details, Products, Transactions, and Tickets tabs
- **FR-045**: Details tab MUST display existing event details functionality
- **FR-046**: Products tab MUST allow management of inventory groups and products
- **FR-047**: Transactions tab MUST display all payment transactions
- **FR-048**: Tickets tab MUST display all tickets with scanning functionality

### Key Entities

- **Inventory Group**: Represents a shared capacity pool for products. Contains name (string), maxCapacity (integer), needsTicket (boolean). Multiple products can reference the same group to share capacity tracking.

- **Product**: Represents a ticket type or purchasable item. Contains name (string), eventId (reference to event), inventoryGroupId (reference to inventory group), price (decimal in EUR), maxQuantity (integer, 0 = unlimited per transaction), features (array of strings), imageUrl (string), stripeProductId (string).

- **Transaction**: Represents a completed payment. Contains totalAmount (decimal), transactionFee (decimal), paymentDate (timestamp), eventId (reference to event), userId (reference to buyer), stripePaymentId (string), list of purchased products with quantities.

- **Ticket**: Represents individual entry permission. Contains ticketId (UUID, database identifier), qrCodeUuid (UUID, encoded in QR), transactionId (reference to transaction), productId (reference to product), eventId (reference to event), buyerId (reference to user), scannedAt (timestamp, nullable).

- **Event**: Existing entity extended to support ticket sales. Maintains relationship to products, transactions, and tickets.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Customers can complete ticket purchase from event page to confirmation in under 3 minutes
- **SC-002**: System handles at least 100 concurrent ticket purchases without performance degradation
- **SC-003**: 95% of ticket purchases complete successfully on first attempt
- **SC-004**: Email confirmations with tickets arrive within 2 minutes of successful payment
- **SC-005**: Staff can scan and validate ticket QR codes in under 5 seconds per ticket
- **SC-006**: Zero tickets are sold beyond inventory group capacity (no overselling)
- **SC-007**: Inventory counts remain accurate across all products sharing same inventory group
- **SC-008**: 100% of successful Stripe payments result in transaction records and ticket generation
- **SC-009**: Customers can access their purchase history and tickets without requiring email lookup
- **SC-010**: Admins can create and publish event products in under 5 minutes per product
- **SC-011**: Telegram notifications arrive within 30 seconds of completed transaction
- **SC-012**: QR code generation endpoint responds within 1 second for any valid ticket
- **SC-013**: Event setup time reduced by 50% compared to manual ticket management processes
- **SC-014**: Support inquiries related to lost tickets reduced by 80% through dashboard access
- **SC-015**: Payment reconciliation time reduced to under 10 minutes per event through transaction reporting

## Assumptions

- Events already exist as a document type in the system with view/edit capabilities
- User authentication and authorization system is already implemented
- Existing upload endpoint can handle image uploads with URLs returned
- Stripe account is configured with appropriate payment methods enabled
- Email delivery system is operational and can send HTML emails with attachments
- Telegram bot is configured with channel access for notifications
- Users have access to devices with cameras or QR code readers for ticket scanning
- EUR is the only currency required for initial implementation
- Event calendar data (date, time, location) is available for iCal generation
- Transaction fees are provided by Stripe and stored separately from gross amount
- Network connectivity is reliable enough for real-time inventory synchronization
- Stripe embedded components are compatible with Qwik framework integration

## Out of Scope

- Multi-currency support (only EUR in initial version)
- Refund processing (handled manually via Stripe dashboard)
- Ticket transfer between users
- Waiting lists for sold-out events
- Dynamic pricing or promotional codes
- Affiliate or reseller programs
- Print-at-home PDF tickets (QR codes only)
- SMS notifications
- Multi-language support for emails and interface
- Ticket exchange or secondary marketplace
- Group booking coordination tools
- Seating selection for venue maps
- Age verification or ID requirements
- Payment installment plans
