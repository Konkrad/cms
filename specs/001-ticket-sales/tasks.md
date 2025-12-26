# Tasks: Ticket Sales System

**Feature Branch**: `001-ticket-sales`  
**Input**: Design documents from `/specs/001-ticket-sales/`  
**Prerequisites**: plan.md, spec.md, data-model.md, api-contracts.md, research.md, quickstart.md

**Tests**: Tests are OPTIONAL and not included in this implementation plan. If tests are explicitly requested later, they can be added as separate tasks.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2)
- Include exact file paths in descriptions

## Path Conventions

This is a single Qwik project with the following structure:
- `src/` - Application source code
- `src/db/schemas/` - Drizzle ORM database schemas
- `src/services/` - Business logic and data access
- `src/routes/` - Qwik City routes (file-based routing)
- `src/components/` - Reusable UI components
- `src/emails/` - React Email templates

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and dependency installation

- [X] T001 Install Stripe SDK with `npm install stripe`
- [X] T002 [P] Install Telegram bot library with `npm install node-telegram-bot-api @types/node-telegram-bot-api`
- [X] T003 [P] Install QR code generation with `npm install qrcode @types/qrcode`
- [X] T004 [P] Install iCalendar generation with `npm install ics`
- [X] T005 [P] Install fuzzy search with `npm install fuse.js`
- [X] T006 [P] Install QR scanner with `npm install html5-qrcode`
- [X] T007 Add Stripe environment variables to src/env.ts (STRIPE_SECRET_KEY, STRIPE_PUBLISHABLE_KEY, STRIPE_WEBHOOK_SECRET)
- [X] T008 Add Telegram environment variables to src/env.ts (TELEGRAM_BOT_TOKEN, TELEGRAM_CHANNEL_ID)
- [X] T009 Update .env.example with new environment variable documentation

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core database schema and utility services that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

### Database Schema

- [X] T010 Create inventory groups schema in src/db/schemas/inventory-groups.ts with table, relations, Zod schemas, and types
- [X] T011 [P] Create products schema in src/db/schemas/products.ts with table, relations, Zod schemas, and types
- [X] T012 [P] Create transactions schema in src/db/schemas/transactions.ts with table, relations, Zod schemas, and types
- [X] T013 [P] Create transaction items schema in src/db/schemas/transaction-items.ts with table, relations, Zod schemas, and types
- [X] T014 [P] Create tickets schema in src/db/schemas/tickets.ts with table, relations, Zod schemas, and types
- [X] T015 Update events schema relations in src/db/schemas/events.ts to include inventoryGroups, products, transactions, and tickets
- [X] T016 Export new schemas from src/db/schema.ts aggregator
- [X] T017 Sync database schema to SQLite with `npx drizzle-kit push --force`

### Utility Services

- [X] T018 [P] Create Stripe service in src/services/stripe.service.ts with product creation and checkout session methods
- [X] T019 [P] Create QR code service in src/services/qrcode.service.ts with PNG generation method
- [X] T020 [P] Create Telegram service in src/services/telegram.service.ts with notification method
- [X] T021 [P] Create iCal service in src/services/ical.service.ts with event ICS generation method

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 2 - Admin Creates Event Products (Priority: P1) 🎯 MVP Prerequisite

**Goal**: Enable event administrators to create inventory groups and products with Stripe synchronization, allowing customers to have something to purchase

**Independent Test**: Login as admin, create an event, navigate to Products tab, create inventory group with capacity, add products with all fields including image, verify products are stored locally and Stripe product IDs are saved

### Implementation for User Story 2

- [X] T022 [P] [US2] Create inventory groups service in src/services/inventory-groups.service.ts with getByEventId, create, update, and validatePurchase methods
- [X] T023 [P] [US2] Create products service in src/services/products.service.ts with getByEventId, create, update, incrementSold methods and Stripe product creation
- [X] T024 [US2] Create admin products page loader in src/routes/admin/events/[id]/products/index.tsx with routeLoader$ to fetch inventory groups and products
- [X] T025 [US2] Create admin products page actions in src/routes/admin/events/[id]/products/index.tsx with routeAction$ for createInventoryGroup, createProduct, updateProduct, deleteProduct
- [X] T026 [US2] Create inventory group form component in src/components/admin/InventoryGroupForm.tsx with name, maxCapacity, and needsTicket fields
- [X] T027 [US2] Create product form component in src/components/admin/ProductForm.tsx with name, price, maxQuantity, features, inventory group selector, and image upload
- [X] T028 [US2] Integrate existing image cropper into product form for image upload in src/components/admin/ProductForm.tsx
- [X] T029 [US2] Create admin products UI in src/routes/admin/events/[id]/products/index.tsx displaying inventory groups with nested products list
- [X] T030 [US2] Add validation and error handling for product creation in src/routes/admin/events/[id]/products/index.tsx

**Checkpoint**: At this point, admins can fully configure event products. This enables User Story 1 (purchase flow).

---

## Phase 4: User Story 1 - Customer Purchases Tickets (Priority: P1) 🎯 MVP Core

**Goal**: Enable customers to browse products, complete payment via Stripe, and receive confirmation email with tickets and QR codes

**Independent Test**: Create event with products (using US2), visit event products page as customer, select tickets, complete payment with test card, verify transaction recorded, tickets generated, email sent with QR codes, and Telegram notification received

### Implementation for User Story 1

- [X] T031 [P] [US1] Create transactions service in src/services/transactions.service.ts with create, findBySessionId, processCheckout, and getByEventId methods
- [X] T032 [P] [US1] Create transaction items service in src/services/transaction-items.service.ts with createBulk method
- [X] T033 [P] [US1] Create tickets service in src/services/tickets.service.ts with create, createBulk, getById, and getByEventId methods
- [X] T034 [US1] Create checkout service in src/services/checkout.service.ts with createSession and validateInventory methods integrating inventory groups and Stripe
- [X] T035 [US1] Create checkout page loader in src/routes/events/[id]/checkout/index.tsx with routeLoader$ to fetch inventory groups, products, and remaining capacity (login required)
- [X] T036 [US1] Create checkout page UI in src/routes/events/[id]/checkout/index.tsx displaying products grouped by inventory group with radio selection per group
- [X] T037 [US1] Create initiate checkout action in src/routes/events/[id]/checkout/index.tsx with routeAction$ validating one product per group and inventory availability
- [X] T038 [US1] Create checkout completion page loader in src/routes/events/[id]/checkout/index.tsx with routeLoader$ to verify Stripe session exists
- [X] T039 [US1] Create checkout status polling action in src/routes/events/[id]/checkout/index.tsx with routeAction$ to check transaction completion
- [X] T040 [US1] Create checkout page UI in src/routes/events/[id]/checkout/index.tsx with Stripe embedded components and polling logic for transaction status
- [X] T041 [US1] Create Stripe webhook handler in src/routes/api/webhooks/stripe/index.ts with signature verification and checkout.session.completed event processing
- [X] T042 [US1] Implement webhook transaction processing in src/routes/api/webhooks/stripe/index.ts with idempotency check, transaction creation, inventory updates, and ticket generation
- [X] T043 [US1] Create ticket confirmation email template in src/emails/ticket-confirmation.tsx with event details, products summary, and conditional ticket section
- [X] T044 [US1] Create ticket links section component in src/emails/components/TicketLinksSection.tsx displaying QR code images for each ticket
- [X] T045 [US1] Create transaction products summary component in src/emails/components/TransactionProductsSummary.tsx displaying purchased items with quantities and prices
- [X] T046 [US1] Integrate email sending in webhook handler in src/routes/api/webhooks/stripe/index.ts with ticket-confirmation template and iCal attachment
- [X] T047 [US1] Integrate Telegram notification in webhook handler in src/routes/api/webhooks/stripe/index.ts sending one message per product with amount and remaining inventory
- [X] T048 [US1] Add error handling and logging for payment failures in src/routes/events/[id]/checkout/index.tsx

**Checkpoint**: At this point, customers can purchase tickets end-to-end with payment processing, email delivery, and notifications. This is the MVP core functionality.

---

## Phase 5: User Story 3 - Staff Scans Tickets at Event (Priority: P2)

**Goal**: Enable event staff to scan ticket QR codes, mark them as scanned, and search tickets by buyer name

**Independent Test**: Create test tickets via purchase flow (US1), access Tickets tab as admin, scan QR codes using camera, verify scanned status recorded, attempt duplicate scan and see warning, search by buyer name using fuzzy search

### Implementation for User Story 3

- [X] T049 [P] [US3] Add scanTicket method to tickets service in src/services/tickets.service.ts marking scannedAt timestamp
- [X] T050 [P] [US3] Add getByQrCodeUuid method to tickets service in src/services/tickets.service.ts for QR code lookup
- [X] T051 [US3] Create QR code image generation endpoint in src/routes/profile/tickets/[id].png/index.ts with infinite cache headers (publicly accessible)
- [X] T052 [US3] Create admin tickets page loader in src/routes/admin/events/[id]/tickets/index.tsx with routeLoader$ to fetch all tickets with buyer info and scan status
- [X] T053 [US3] Create scan ticket action in src/routes/admin/events/[id]/tickets/index.tsx with routeAction$ processing QR code UUID
- [X] T054 [US3] Create ticket scanner component in src/components/admin/TicketScanner.tsx integrating html5-qrcode with pause/resume logic
- [X] T055 [US3] Add scan result feedback in src/components/admin/TicketScanner.tsx with success/failure overlays and vibration
- [X] T056 [US3] Create ticket search component in src/components/admin/TicketSearch.tsx integrating fuse.js for fuzzy name search
- [X] T057 [US3] Create tickets list component in src/components/admin/TicketsList.tsx displaying tickets with scan status and manual scan button
- [X] T058 [US3] Create admin tickets page UI in src/routes/admin/events/[id]/tickets/index.tsx combining scanner, search, and list components
- [X] T059 [US3] Add duplicate scan warning logic in scan action in src/routes/admin/events/[id]/tickets/index.tsx

**Checkpoint**: Event staff can now scan and validate tickets at entry with real-time feedback and search capability.

---

## Phase 6: User Story 4 - Customer Views Purchase History (Priority: P3)

**Goal**: Enable customers to view their past transactions and access tickets via dashboard without needing email

**Independent Test**: Login as customer who made purchases, navigate to dashboard, verify all transactions displayed, verify all tickets with QR codes accessible, verify tickets grouped by upcoming vs past events

### Implementation for User Story 4

- [X] T060 [P] [US4] Add getByUserId method to transactions service in src/services/transactions.service.ts fetching user's transactions with products
- [X] T061 [P] [US4] Add getByBuyerId method to tickets service in src/services/tickets.service.ts fetching user's tickets with event info
- [X] T062 [US4] Create user dashboard loader in src/routes/profile/tickets/index.tsx with routeLoader$ to fetch user transactions and tickets
- [X] T063 [US4] Create transactions list component in src/components/profile/TransactionsList.tsx displaying past purchases with dates and totals
- [X] T064 [US4] Create user tickets component in src/components/profile/UserTickets.tsx displaying tickets grouped by event with QR code links
- [X] T065 [US4] Create user dashboard page in src/routes/profile/tickets/index.tsx combining transactions and tickets with upcoming/past event separation
- [X] T066 [US4] Add QR code display modal in src/components/profile/UserTickets.tsx for full-screen ticket viewing

**Checkpoint**: Customers can now access their complete purchase history and tickets through the dashboard.

---

## Phase 7: User Story 5 - Admin Reviews Transactions (Priority: P3)

**Goal**: Enable administrators to view all transactions for an event with financial details and product breakdowns

**Independent Test**: Create test transactions via purchase flow, login as admin, navigate to Transactions tab, verify all transactions displayed with amounts and fees, expand transaction to see product list, verify sorted by date

### Implementation for User Story 5

- [X] T067 [P] [US5] Add getByEventIdWithDetails method to transactions service in src/services/transactions.service.ts fetching transactions with items and buyer info
- [X] T068 [US5] Create admin transactions page loader in src/routes/admin/events/[id]/transactions/index.tsx with routeLoader$ supporting cursor-based pagination
- [X] T069 [US5] Create transaction card component in src/components/admin/TransactionCard.tsx displaying summary with expandable details
- [X] T070 [US5] Create transactions list component in src/components/admin/TransactionsList.tsx with pagination controls
- [X] T071 [US5] Create admin transactions page UI in src/routes/admin/events/[id]/transactions/index.tsx displaying sorted transaction list with totals summary
- [X] T072 [US5] Add financial summary section in src/routes/admin/events/[id]/transactions/index.tsx showing total revenue and fees

**Checkpoint**: Administrators now have complete financial reporting for each event.

---

## Phase 8: Admin Interface Layout

**Purpose**: Create navigation structure and layout for admin event management

- [X] T073 Create admin event layout in src/routes/admin/events/[id]/layout.tsx with tab navigation for Details, Products, Transactions, and Tickets
- [X] T074 Style tab navigation in src/routes/admin/events/[id]/layout.tsx with active state indicators
- [X] T075 Ensure existing Details tab integration in src/routes/admin/events/[id]/details/index.tsx works with new layout

---

## Phase 9: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [X] T076 [P] Add loading states to all form submissions across admin and public pages
- [X] T077 [P] Add success/error toast notifications across application using existing notification system
- [X] T078 Add inventory validation edge case handling in checkout service for concurrent purchase conflicts in src/services/checkout.service.ts
- [X] T079 Add webhook retry logging and alerting in src/routes/api/webhooks/stripe/index.ts for failed email or ticket generation
- [X] T080 Optimize QR code generation performance with error correction level tuning in src/services/qrcode.service.ts
- [X] T081 Add proper TypeScript error handling throughout services following constitution guidelines
- [X] T082 Add product image validation and upload error handling in product form
- [X] T083 Test complete purchase flow following quickstart.md validation scenarios
- [X] T084 Verify Stripe webhook signature verification works with test webhooks
- [X] T085 Test concurrent purchase edge cases with same inventory group
- [X] T086 Verify email delivery with all attachment types (iCal, QR codes)
- [X] T087 Test QR scanner in different lighting conditions and devices

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Story 2 (Phase 3)**: Depends on Foundational phase - MUST complete before User Story 1
- **User Story 1 (Phase 4)**: Depends on Foundational and User Story 2 - This is the MVP core
- **User Story 3 (Phase 5)**: Depends on Foundational and User Story 1 - Can start after US1 complete
- **User Story 4 (Phase 6)**: Depends on Foundational and User Story 1 - Can run parallel with US3
- **User Story 5 (Phase 7)**: Depends on Foundational and User Story 1 - Can run parallel with US3/US4
- **Admin Layout (Phase 8)**: Can start anytime after Foundational - Should complete before US2
- **Polish (Phase 9)**: Depends on all desired user stories being complete

### User Story Dependencies

- **User Story 2 (P1 - Admin Products)**: Must complete FIRST - No dependencies on other stories but provides products for purchase
- **User Story 1 (P1 - Customer Purchase)**: Must complete SECOND - Depends on User Story 2 (needs products to purchase)
- **User Story 3 (P2 - Ticket Scanning)**: Depends on User Story 1 (needs tickets to scan) - Can run parallel with US4/US5
- **User Story 4 (P3 - Customer Dashboard)**: Depends on User Story 1 (needs transactions to display) - Can run parallel with US3/US5
- **User Story 5 (P3 - Admin Transactions)**: Depends on User Story 1 (needs transactions to display) - Can run parallel with US3/US4

### Critical Path for MVP

```
Setup (Phase 1) 
  → Foundational (Phase 2) 
  → User Story 2 (Phase 3 - Products) 
  → User Story 1 (Phase 4 - Purchase) 
  = SHIPPABLE MVP
```

### Within Each User Story

- Services before route actions/loaders
- Route loaders/actions before UI components
- UI components before page integration
- Core implementation before edge case handling

### Parallel Opportunities

- **Phase 1 (Setup)**: All npm install tasks (T001-T006) can run in parallel
- **Phase 2 (Foundational)**: 
  - Schema creation (T011-T014) can run in parallel after T010
  - Utility services (T018-T021) can run in parallel after schema sync (T017)
- **Phase 3 (US2)**: 
  - Services (T022-T023) can run in parallel
  - Form components (T026-T027) can run in parallel after actions complete
- **Phase 4 (US1)**:
  - Services (T031-T033) can run in parallel
  - Email components (T044-T045) can run in parallel
- **Phase 5 (US3)**:
  - Service methods (T049-T050) can run in parallel
  - Components (T054, T056, T057) can be built in parallel after actions complete
- **Phase 6-7 (US4-US5)**: Can work on these user stories in parallel once US1 is complete
- **Phase 9 (Polish)**: Most tasks (T076-T077, T080-T081) can run in parallel

---

## Parallel Example: User Story 1 (Purchase Flow)

```bash
# Launch core services together:
Task T031: "Create transactions service"
Task T032: "Create transaction items service"
Task T033: "Create tickets service"

# Launch email components together (after email template T043):
Task T044: "Create ticket links section component"
Task T045: "Create transaction products summary component"
```

---

## Parallel Example: User Story 3 (Scanning)

```bash
# Launch service methods together:
Task T049: "Add scanTicket method to tickets service"
Task T050: "Add getByQrCodeUuid method to tickets service"

# Launch UI components together (after actions complete):
Task T054: "Create ticket scanner component"
Task T056: "Create ticket search component"
Task T057: "Create tickets list component"
```

---

## Implementation Strategy

### MVP First (User Stories 2 + 1)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL - blocks all stories)
3. Complete Phase 8: Admin Layout (enables tab navigation)
4. Complete Phase 3: User Story 2 (Admin creates products)
5. Complete Phase 4: User Story 1 (Customer purchases tickets)
6. **STOP and VALIDATE**: Test complete purchase flow end-to-end
7. Deploy/demo if ready - **This is the shippable MVP**

### Incremental Delivery

1. **MVP Release**: Setup + Foundational + Admin Layout + US2 + US1 → Ticket sales operational
2. **Release 2**: Add US3 (Ticket Scanning) → Event access control enabled
3. **Release 3**: Add US4 + US5 (Dashboards) → Self-service and reporting improved
4. Each release adds value without breaking previous functionality

### Parallel Team Strategy

With multiple developers:

1. **Team completes together**: Setup + Foundational + Admin Layout
2. **Sequential on critical path**:
   - Developer A: User Story 2 (Products) - Must complete first
   - Developer A continues: User Story 1 (Purchase) - Must complete second
3. **Once US1 complete, parallelize**:
   - Developer A: User Story 3 (Scanning)
   - Developer B: User Story 4 (Customer Dashboard)
   - Developer C: User Story 5 (Admin Transactions)
4. **Team completes together**: Polish phase

---

## Estimated Timeline

### Time Estimates by Phase

- **Phase 1 (Setup)**: 1-2 hours
- **Phase 2 (Foundational)**: 8-12 hours
- **Phase 3 (US2 - Products)**: 8-10 hours
- **Phase 4 (US1 - Purchase)**: 16-20 hours
- **Phase 5 (US3 - Scanning)**: 8-10 hours
- **Phase 6 (US4 - Dashboard)**: 6-8 hours
- **Phase 7 (US5 - Transactions)**: 6-8 hours
- **Phase 8 (Admin Layout)**: 2-3 hours
- **Phase 9 (Polish)**: 8-10 hours

**Total**: 63-83 hours

**MVP (Phases 1+2+8+3+4)**: ~35-45 hours

### Acceptance Criteria by Phase

**MVP Ready When:**
- [ ] Admin can create inventory groups and products
- [ ] Products sync to Stripe with product IDs stored
- [ ] Customer can select products (one per inventory group)
- [ ] Customer can complete Stripe checkout
- [ ] Webhook processes payment and creates transaction
- [ ] Inventory decrements correctly
- [ ] Tickets generate with unique QR codes
- [ ] Confirmation email sends with QR codes and iCal
- [ ] Telegram notification sends
- [ ] Concurrent purchases respect inventory limits
- [ ] Payment failures handled gracefully

**Full Feature Complete When:**
- [ ] All MVP criteria met
- [ ] Staff can scan QR codes and mark tickets
- [ ] Duplicate scans show warnings
- [ ] Staff can search tickets by name
- [ ] Customers can view purchase history in dashboard
- [ ] Admins can view transaction reports
- [ ] All edge cases handled with clear errors
- [ ] All quickstart.md validation scenarios pass

---

## Notes

- Tasks marked [P] operate on different files and can run in parallel
- [Story] labels map tasks to specific user stories for traceability
- User Story 2 must complete before User Story 1 (products before purchases)
- Each user story should be independently testable at its checkpoint
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- Avoid: vague tasks, same file conflicts, skipping validation steps
- Follow constitution: centralized config, schema-driven design, service layer pattern
- No backwards compatibility needed - break things and fix call sites
- Stripe webhook is the single REST API endpoint - everything else uses Qwik route actions/loaders

---

## Technology Stack Reference

- **Framework**: Qwik 1.7+ with Qwik City
- **Database**: SQLite with Drizzle ORM 0.45+
- **Validation**: Zod 4.2+
- **Payment**: Stripe SDK
- **Email**: react-email (existing), nodemailer (existing), ics
- **Notifications**: node-telegram-bot-api
- **QR**: qrcode (generation), html5-qrcode (scanning)
- **Search**: fuse.js (fuzzy search)
- **Styling**: Tailwind CSS 3.4+
