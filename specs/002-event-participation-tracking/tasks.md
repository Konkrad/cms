---

description: "Task list for Event Participation Tracking & Enhanced Features"
---

# Tasks: Event Participation Tracking & Enhanced Features

**Input**: Design documents from `/specs/002-event-participation-tracking/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Tests are NOT requested in this specification. Following TDD is optional.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and dependencies

- [X] T001 Install QR code dependencies: `npm install qrcode html5-qrcode @types/qrcode`
- [X] T002 [P] Install Uppy.io v5 dependencies: `npm install @uppy/core @uppy/dashboard @uppy/xhr-upload`
- [X] T003 [P] Verify environment configuration in src/env.ts includes photo secret support

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Database schemas and utilities that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

### Database Schema

- [X] T004 Create ticket-participants schema in src/db/schemas/ticket-participants.ts
- [X] T005 [P] Create participation-status schema in src/db/schemas/participation-status.ts
- [X] T006 [P] Create event-photos schema in src/db/schemas/event-photos.ts
- [X] T007 [P] Extend events schema with salesStartDate and salesEndDate in src/db/schemas/events.ts
- [X] T008 [P] Extend products schema with participantCapacity field in src/db/schemas/products.ts
- [X] T009 [P] Extend tickets schema with isFree field and scannedAt index in src/db/schemas/tickets.ts
- [X] T010 Export new schemas in src/db/schema.ts
- [X] T011 Generate Drizzle migrations with `npx drizzle-kit generate`
- [X] T012 Apply database migrations with `npx drizzle-kit migrate`

### Core Utilities

- [X] T013 [P] Create QR code utility in src/utils/qr-code.ts with generation and validation functions
- [X] T014 [P] Create secure URL utility in src/utils/secure-urls.ts with HMAC signing functions

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - Ticket Scanning for Attendance Verification (Priority: P1) 🎯 MVP

**Goal**: Enable organizers to scan ticket QR codes at event entrance to verify attendance and mark tickets as attended

**Independent Test**: Create test event, generate test ticket with QR code, scan QR code via admin interface, verify ticket marked as attended with timestamp, confirm duplicate scan detection works

### Implementation for User Story 1

- [X] T015 [US1] Extend tickets service with scanTicket method in src/services/tickets.service.ts
- [X] T016 [US1] Create TicketScanner component in src/components/events/TicketScanner.tsx using html5-qrcode
- [X] T017 [US1] Create admin scan route with routeAction$ in src/routes/admin/events/[id]/scan/index.tsx
- [X] T018 [US1] Add QR code generation to ticket creation flow in existing ticket service
- [X] T019 [US1] Update ticket display to show QR code and scan status in ticket detail views
- [X] T020 [US1] Add validation for duplicate scans and invalid QR codes in scan action
- [X] T021 [US1] Create attendance report view in src/routes/admin/events/[id]/attendance/index.tsx

**Checkpoint**: Ticket scanning complete - organizers can scan tickets and verify attendance independently

---

## Phase 4: User Story 2 - Free Tickets (Priority: P2)

**Goal**: Support free events and complimentary tickets without payment processing

**Independent Test**: Create free event, register attendee without payment, verify ticket issued with isFree=true, scan ticket successfully, create paid event and issue comp ticket, verify reporting distinguishes free vs paid

### Implementation for User Story 2

- [X] T022 [P] [US2] Update event service to support free event configuration in src/services/events.service.ts
- [X] T023 [P] [US2] Update ticket service to handle free ticket creation in src/services/tickets.service.ts
- [X] T024 [US2] Modify checkout flow to skip payment for free tickets in existing checkout routes
- [X] T025 [US2] Add UI for marking event as free in event creation/edit forms
- [X] T026 [US2] Add admin function to issue complimentary tickets in src/routes/admin/events/[id]/comp-tickets/index.tsx
- [X] T027 [US2] Update attendance reports to distinguish free vs paid tickets

**Checkpoint**: Free tickets complete - can create free events and comp tickets independently

---

## Phase 5: User Story 3 - Product Participant Capacity (Priority: P2)

**Goal**: Support multi-person products like hotel rooms where one purchase covers multiple participants

**Independent Test**: Create product with participantCapacity=3, purchase product, verify checkout prompts for 3 participant details, complete purchase with all participant data, verify all participants stored in ticketParticipants table, view ticket detail showing all participants

### Implementation for User Story 3

- [X] T028 [US3] Create participant service in src/services/participants.service.ts with CRUD operations
- [X] T029 [US3] Update product creation UI to include participant capacity field in admin product forms
- [ ] T030 [US3] Modify checkout flow to collect participant details based on capacity in existing checkout route
- [X] T031 [US3] Create ParticipantForm component in src/components/events/ParticipantForm.tsx
- [ ] T032 [US3] Add participant detail validation in checkout routeAction$
- [ ] T033 [US3] Update ticket display to show all associated participants in ticket views
- [ ] T034 [US3] Extend ticket scanner to display participant information when scanning

**Checkpoint**: Multi-participant products complete - can configure capacity and collect participant data independently

---

## Phase 6: User Story 4 - Sales Period Configuration (Priority: P3)

**Goal**: Control ticket availability by defining sales start and end dates

**Independent Test**: Create event with salesStartDate in future, verify purchase blocked with message, update salesStartDate to past, verify purchase allowed, set salesEndDate to past, verify purchase blocked with closed message

### Implementation for User Story 4

- [X] T035 [P] [US4] Add sales period validation to events service in src/services/events.service.ts
- [ ] T036 [US4] Update event creation/edit forms to include sales period fields in admin event forms
- [X] T037 [US4] Add sales period validation to checkout flow routeAction$
- [X] T038 [US4] Create UI messaging for pre-sale and post-sale states in event detail views
- [ ] T039 [US4] Add sales period validation to product purchase endpoints

**Checkpoint**: Sales period control complete - can restrict ticket sales by time window independently

---

## Phase 7: User Story 5 - Participation Status Tracking (Priority: P4)

**Goal**: Allow users to indicate participation intent (yes/no/maybe) separate from ticket purchases

**Independent Test**: Create free event, user selects "Yes" (should register immediately), create paid event, user selects "Maybe" (should record intent), user purchases ticket (should auto-upgrade to "Yes"), organizer views participation summary showing correct counts

### Implementation for User Story 5

- [X] T040 [US5] Create participation service in src/services/participation.service.ts
- [X] T041 [US5] Create ParticipationToggle component in src/components/events/ParticipationToggle.tsx
- [X] T042 [US5] Add participation routeAction$ and routeLoader$ to event detail route in src/routes/events/[id]/index.tsx
- [ ] T043 [US5] Implement auto-upgrade from "maybe" to "yes" on ticket purchase in transaction completion
- [X] T044 [US5] Create participation summary view for organizers in src/routes/admin/events/[id]/participation/index.tsx
- [ ] T045 [US5] Add participation counts to event overview displays

**Checkpoint**: Participation tracking complete - users can indicate intent and organizers see summary independently

---

## Phase 8: User Story 6 - Private Event Photos (Priority: P5)

**Goal**: Allow organizers to upload event photos accessible only to verified attendees via time-limited secure URLs

**Independent Test**: Complete event with scanned attendees, organizer uploads photos via Uppy, attendee who was scanned views photo gallery and accesses photos via secure URLs, non-attendee cannot access photos, verify URLs expire after 1 hour

### Implementation for User Story 6

- [ ] T046 [US6] Create photos service in src/services/photos.service.ts with upload, access control, and URL generation
- [ ] T047 [US6] Create PhotoUploader component in src/components/events/PhotoUploader.tsx using Uppy.io
- [ ] T048 [US6] Create PhotoGallery component in src/components/events/PhotoGallery.tsx with lazy loading
- [ ] T049 [US6] Create photo upload admin route in src/routes/admin/events/[id]/photos/index.tsx with routeAction$
- [ ] T050 [US6] Create photo gallery route in src/routes/events/[id]/photos/index.tsx with routeLoader$ for attendance validation
- [ ] T051 [US6] Create secure photo serving REST API endpoint in src/routes/api/photos/serve/index.ts
- [ ] T052 [US6] Add secure URL generation routeAction$ in photo gallery route
- [ ] T053 [US6] Configure Uppy to use existing /api/upload endpoint with private path headers
- [ ] T054 [US6] Create /private/events/ directory structure with proper permissions

**Checkpoint**: Private photos complete - organizers can upload and attendees can securely view photos independently

---

## Phase 9: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [ ] T055 [P] Add comprehensive error handling across all new services
- [ ] T056 [P] Update event detail page to integrate all new features (participation toggle, photo gallery access)
- [ ] T057 [P] Add admin dashboard widgets for attendance stats, participation counts, and photo upload status
- [ ] T058 [P] Optimize database queries with proper indexes from data-model.md
- [ ] T059 Performance testing: Verify QR scan validation completes in <100ms
- [ ] T060 Performance testing: Test concurrent photo uploads and gallery loading
- [ ] T061 [P] Security audit: Verify HMAC signature validation on all secure endpoints
- [ ] T062 [P] Security audit: Test path traversal prevention in photo serving endpoint
- [ ] T063 Add cache headers for secure photo URLs (1 hour expiry, allow page reload)
- [ ] T064 Run quickstart.md validation scenarios
- [ ] T065 Create admin documentation for ticket scanning workflow
- [ ] T066 Create user documentation for participation and photo features

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3-8)**: All depend on Foundational phase completion
  - User stories can then proceed in parallel (if staffed)
  - Or sequentially in priority order (P1 → P2 → P2 → P3 → P4 → P5)
- **Polish (Phase 9)**: Depends on all desired user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - No dependencies on other stories
- **User Story 2 (P2)**: Can start after Foundational (Phase 2) - Integrates with US1 ticket scanning but independently testable
- **User Story 3 (P2)**: Can start after Foundational (Phase 2) - Extends checkout but independently testable
- **User Story 4 (P3)**: Can start after Foundational (Phase 2) - No dependencies on other stories
- **User Story 5 (P4)**: Can start after Foundational (Phase 2) - Integrates with ticket purchase but independently testable
- **User Story 6 (P5)**: Depends on User Story 1 completion (requires attendance verification) - Cannot test without scanning capability

### Within Each User Story

- Services before components
- Components before routes
- Routes before integration
- Core implementation before polish

### Parallel Opportunities

- Phase 1: All setup tasks (T001-T003) can run in parallel
- Phase 2 Database: Schema creation tasks (T005, T006, T007, T008, T009) can run in parallel after T004
- Phase 2 Utilities: T013 and T014 can run in parallel with database schema tasks
- Once Foundational phase completes:
  - User Stories 1, 2, 3, 4, 5 can all start in parallel (different team members)
  - User Story 6 must wait for User Story 1 scanning functionality
- Within User Story 1: T015, T016, T018 can start in parallel (different files)
- Within User Story 2: T022, T023 can start in parallel (different files)
- Within User Story 4: T035 and T036 can start in parallel (different files)
- Phase 9: Most polish tasks (T055-T063, T065-T066) can run in parallel

---

## Parallel Example: Foundational Phase

```bash
# After T004 completes, launch schema extensions in parallel:
Task T005: "Create participation-status schema in src/db/schemas/participation-status.ts"
Task T006: "Create event-photos schema in src/db/schemas/event-photos.ts"
Task T007: "Extend events schema with salesStartDate and salesEndDate in src/db/schemas/events.ts"
Task T008: "Extend products schema with participantCapacity field in src/db/schemas/products.ts"
Task T009: "Extend tickets schema with isFree field in src/db/schemas/tickets.ts"

# Simultaneously with schema work:
Task T013: "Create QR code utility in src/utils/qr-code.ts"
Task T014: "Create secure URL utility in src/utils/secure-urls.ts"
```

---

## Parallel Example: User Story 1

```bash
# Launch core implementation tasks together:
Task T015: "Extend tickets service with scanTicket method in src/services/tickets.service.ts"
Task T016: "Create TicketScanner component in src/components/events/TicketScanner.tsx"
Task T018: "Add QR code generation to ticket creation flow in existing ticket service"
```

---

## Parallel Example: Multiple User Stories

```bash
# After Foundational phase, different developers can work on:
Developer A → User Story 1 (T015-T021): Ticket Scanning
Developer B → User Story 2 (T022-T027): Free Tickets
Developer C → User Story 3 (T028-T034): Participant Capacity
Developer D → User Story 4 (T035-T039): Sales Periods
Developer E → User Story 5 (T040-T045): Participation Status
# Developer F waits for User Story 1 completion before starting User Story 6
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001-T003)
2. Complete Phase 2: Foundational (T004-T014) - CRITICAL, blocks all stories
3. Complete Phase 3: User Story 1 (T015-T021)
4. **STOP and VALIDATE**: Test ticket scanning independently
   - Create event, generate tickets, scan QR codes
   - Verify attendance marking, duplicate detection
   - Check attendance reports
5. Deploy/demo MVP if ready

### Incremental Delivery

1. **Foundation**: Complete Setup + Foundational → Database and utilities ready
2. **MVP (US1)**: Add Ticket Scanning → Test independently → Deploy (core attendance tracking)
3. **Enhancement 1 (US2)**: Add Free Tickets → Test independently → Deploy (enables free events)
4. **Enhancement 2 (US3)**: Add Participant Capacity → Test independently → Deploy (multi-person products)
5. **Enhancement 3 (US4)**: Add Sales Periods → Test independently → Deploy (time-based sales control)
6. **Enhancement 4 (US5)**: Add Participation Status → Test independently → Deploy (RSVP capability)
7. **Enhancement 5 (US6)**: Add Private Photos → Test independently → Deploy (post-event value)
8. Each story adds value without breaking previous stories

### Parallel Team Strategy

With 5+ developers after Foundational phase:

1. Complete Setup + Foundational together (essential foundation)
2. Once Foundational done (checkpoint reached):
   - Dev Team A: User Story 1 (Ticket Scanning)
   - Dev Team B: User Story 2 (Free Tickets)
   - Dev Team C: User Story 3 (Participant Capacity)
   - Dev Team D: User Story 4 (Sales Periods)
   - Dev Team E: User Story 5 (Participation Status)
3. After US1 completes:
   - Dev Team A: User Story 6 (Private Photos) - requires US1 attendance verification
4. Stories complete and integrate independently
5. Polish phase brings it all together

---

## Task Summary

- **Total Tasks**: 66
- **Setup**: 3 tasks
- **Foundational**: 11 tasks (BLOCKS all user stories)
- **User Story 1 (P1)**: 7 tasks - MVP core functionality
- **User Story 2 (P2)**: 6 tasks
- **User Story 3 (P2)**: 7 tasks
- **User Story 4 (P3)**: 5 tasks
- **User Story 5 (P4)**: 6 tasks
- **User Story 6 (P5)**: 9 tasks - depends on US1
- **Polish**: 12 tasks

### Parallel Opportunities Identified

- **Setup Phase**: 2 parallel tasks (T002, T003)
- **Foundational Phase**: 7 parallel tasks (T005-T009, T013-T014)
- **User Stories**: 5 stories can start in parallel after Foundational (US1-US5)
- **Within Stories**: 10+ tasks marked [P] for parallel execution
- **Polish Phase**: 9 parallel tasks (T055-T058, T061-T063, T065-T066)

### Independent Test Criteria

- **US1**: Scan tickets, verify attendance marking, test duplicate detection
- **US2**: Create free events, issue comp tickets, verify no payment required
- **US3**: Configure capacity, collect participant data, verify all details stored
- **US4**: Set sales periods, test pre-sale/active/closed states
- **US5**: Toggle participation status, verify auto-upgrade on purchase
- **US6**: Upload photos, verify attendance-based access, test secure URL expiry

### Suggested MVP Scope

**Minimum Viable Product**: User Story 1 only
- Provides core value: attendance verification via QR scanning
- Foundation for all other features (especially US6)
- Delivers immediate operational benefit for event organizers
- Estimated: 21 tasks (Setup + Foundational + US1)

**Recommended First Release**: User Stories 1-3
- Core scanning + free events + multi-participant products
- Covers most common event scenarios
- Estimated: 40 tasks

---

## Notes

- All tasks follow strict checklist format: `- [ ] [ID] [P?] [Story?] Description with file path`
- [P] indicates tasks that can be executed in parallel (different files, no blocking dependencies)
- [Story] label maps task to user story for traceability (US1, US2, etc.)
- Tests are OPTIONAL - not included per specification requirements
- Each user story is independently completable and testable
- Foundational phase MUST complete before any user story work begins
- User Story 6 requires User Story 1 completion for attendance verification
- Commit after each task or logical group for clean history
- Stop at any checkpoint to validate story independently before proceeding
