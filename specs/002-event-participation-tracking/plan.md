# Implementation Plan: Event Participation Tracking & Enhanced Features

**Branch**: `002-event-participation-tracking` | **Date**: 2025-12-29 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/002-event-participation-tracking/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

Enhance the events system with ticket scanning for attendance verification, participation tracking (yes/no/maybe/verified status), sales period configuration per inventory, private event photos accessible only to verified attendees, and support for free tickets at both event and individual ticket levels. Key changes include: moving sales periods to inventory level, making participants independent entities that map users to events, merging participation status into participants table, simplifying event photos schema, and removing participant capacity requirements.

## Technical Context

**Language/Version**: TypeScript 5.4+, Node.js 20+  
**Primary Dependencies**: Qwik 1.7+, Drizzle ORM 0.45+, Zod 4.2+  
**Storage**: SQLite (development), Turso/libSQL (production consideration)  
**Testing**: Vitest (existing in project)  
**Target Platform**: Web application (SSR + client-side)
**Project Type**: Web - monolithic Qwik application  
**Performance Goals**: <100ms server response for ticket scanning, <2s photo URL generation  
**Constraints**: Mobile-friendly ticket scanning UI, secure photo access, real-time attendance updates  
**Scale/Scope**: ~100 events/month, ~1000 attendees/event, ~100 photos/event

**Existing Schema Context**:
- Events table: id, title, body, startDate, endDate, location fields, userId (organizer)
- Inventory groups: id, eventId, name, maxCapacity, needsTicket
- Products: id, eventId, inventoryGroupId, name, price, maxQuantity, features, soldQuantity
- Tickets: id, qrCodeUuid, transactionId, productId, eventId, buyerId, scannedAt
- Users: id, name, email (normal system users)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Principle I: Centralized Configuration
- ✅ PASS: All environment variables (e.g., S3/storage credentials for photos) will be added to `src/env.ts` with Zod validation
- ✅ PASS: No direct `process.env` access outside env.ts

### Principle II: Schema-Driven Database Design
- ✅ PASS: New tables (participants, event_photos, photo_access_urls) will be defined in `src/db/schemas/`
- ✅ PASS: Drizzle-zod integration for insert/select/update schemas
- ✅ PASS: Modified tables (events, inventory_groups) follow existing patterns

### Principle III: Service Layer Pattern
- ✅ PASS: New services created: `participants.service.ts`, `event-photos.service.ts`, `ticket-scanning.service.ts`
- ✅ PASS: Services defined in quickstart.md with proper patterns
- ✅ PASS: All validation through Zod schemas, all DB access through Drizzle

### Principle IV: Qwik Framework Conventions
- ✅ PASS: Ticket scanning UI will use `component$()` and `useSignal()` for reactive state
- ✅ PASS: Photo galleries will use `routeLoader$()` for server-side photo list loading
- ✅ PASS: Participation status updates will use `routeAction$()` with `zod$()`
- ✅ PASS: QR code scanning will leverage client-side camera APIs with server validation

### Principle V: Component Organization
- ✅ PASS: New components in appropriate directories:
  - `src/components/events/` - TicketScanner, ParticipationButton, PhotoGallery
  - `src/components/ui/` - QRCodeDisplay (if needed)

### Principle VI: Type Safety Without Redundancy
- ✅ PASS: Will use existing `@aws-sdk/client-s3` types for R2 operations
- ✅ PASS: All types generated from Zod schemas via `z.infer`
- ✅ PASS: No manual type duplication

### Principle VII: Fail Fast, Handle Gracefully
- ✅ PASS: Expected errors (invalid QR, duplicate scan, unauthorized photo access) handled in services
- ✅ PASS: Unexpected errors (DB failures, S3 failures) will bubble up
- ✅ PASS: Input validation at service layer before any side effects

**GATE STATUS**: ✅ ALL CHECKS PASSED (Initial + Post-Design)

**Post-Design Validation**:
- Data model reviewed: 2 modified tables, 3 new tables, all following Drizzle patterns ✅
- API contracts reviewed: 5 endpoints with proper validation and error handling ✅
- Services designed: Follow single responsibility, use transactions appropriately ✅
- No constitution violations introduced during design phase ✅

## Project Structure

### Documentation (this feature)

```text
specs/[###-feature]/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
src/
├── db/
│   ├── schemas/
│   │   ├── events.ts              # Modified: add isFree field
│   │   ├── inventory-groups.ts    # Modified: add salesStartDate, salesEndDate
│   │   ├── tickets.ts             # Existing: already has scannedAt
│   │   ├── participants.ts        # NEW: user-event mappings with status
│   │   ├── event-photos.ts        # NEW: private photo storage references
│   │   └── photo-access-urls.ts   # NEW: time-limited secure URLs
│   └── connection.ts
│
├── services/
│   ├── events.service.ts          # Modified: handle free events
│   ├── tickets.service.ts         # Modified: ticket scanning logic
│   ├── participants.service.ts    # NEW: participation status management
│   ├── event-photos.service.ts    # NEW: photo upload/access control
│   └── photo-urls.service.ts      # NEW: secure URL generation
│
├── routes/
│   ├── admin/
│   │   └── events/
│   │       └── [eventId]/
│   │           ├── scan/          # NEW: ticket scanning interface
│   │           └── photos/        # NEW: photo upload interface
│   └── events/
│       └── [eventId]/
│           ├── index.tsx          # Modified: participation buttons
│           └── photos/            # NEW: attendee photo gallery
│
└── components/
    └── events/
        ├── TicketScanner.tsx      # NEW: QR scanner component
        ├── ParticipationButton.tsx # NEW: yes/no/maybe UI
        └── PhotoGallery.tsx       # NEW: private photo display

tests/
├── services/
│   ├── participants.service.test.ts
│   ├── event-photos.service.test.ts
│   └── ticket-scanning.test.ts
└── integration/
    └── ticket-scanning-flow.test.ts
```

**Structure Decision**: Web application structure with feature modules organized by domain (events, tickets, participants, photos). Services encapsulate business logic, routes handle HTTP interface, components provide UI. Testing focuses on service layer and critical user flows.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

No violations detected. All features align with existing constitution principles.
