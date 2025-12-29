# Implementation Plan: Event Participation Tracking & Enhanced Features

**Branch**: `002-event-participation-tracking` | **Date**: 2025-12-29 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/002-event-participation-tracking/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

Enhance the events system with six integrated features: (P1) Ticket Scanning for Attendance Verification using QR codes, (P2) Free Tickets configuration for community events and comps, (P2) Product Participant Capacity for multi-person products like hotel rooms, (P3) Sales Period Configuration to control ticket availability windows, (P4) Participation Status Tracking for RSVP/interest indication, and (P5) Private Event Photos accessible only to verified attendees via time-limited secure URLs.

**Technical approach**: Extend existing database schemas (events, products, tickets) with new fields, add three new tables (ticketParticipants, participationStatus, eventPhotos), leverage **Qwik server functions** (`routeAction$`/`routeLoader$`) for all client-server communication except photo serving which requires a REST endpoint for signed URL validation. QR generation via `qrcode` package, scanning via `html5-qrcode`, photo uploads via Uppy.io v5 integrated with existing `/api/upload` endpoint, secure URLs via HMAC-SHA256 signing.

**CRITICAL ARCHITECTURE NOTE**: See [ARCHITECTURE.md](./ARCHITECTURE.md) for detailed explanation of why most functionality uses Qwik server functions instead of REST APIs. Only `/api/photos/serve` is a true REST endpoint.

## Technical Context

**Language/Version**: TypeScript 5.4+ (strict mode)  
**Primary Dependencies**: Qwik 1.7+, Qwik City (routing), Drizzle ORM 0.45+, qrcode ^1.5.3, html5-qrcode ^2.3.8, @uppy/core ^5.0.0  
**Storage**: SQLite (local dev) with Drizzle schema, file system for private photos under `/private/events/{eventId}/photos/`  
**Testing**: Vitest (existing), unit tests for services, integration tests for route actions  
**Target Platform**: Web (SSR + client-side resumability), mobile-responsive for QR scanning  
**Project Type**: Web application (Qwik-based)  
**Performance Goals**: QR scan validation <100ms, secure URL generation <1ms, photo gallery lazy loading, scan 100 tickets in <5 minutes  
**Constraints**: Ticket scanning requires real-time internet (per requirements), photo URLs expire in 1 hour, HMAC-based signature validation  
**Scale/Scope**: Support events with 100+ attendees, 500+ high-res photos per event, multi-participant products (1-10 capacity), concurrent scanning by organizers

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### I. Centralized Configuration ✅
- **Status**: PASS
- **Analysis**: New environment variable `PHOTO_URL_SECRET` added to `src/env.ts` with Zod validation for HMAC signing. QR signing secret already exists or will be added to same file. No direct `process.env` access.

### II. Schema-Driven Database Design ✅
- **Status**: PASS
- **Analysis**: Three new schema files follow pattern: `ticket-participants.ts`, `participation-status.ts`, `event-photos.ts`. Extensions to existing schemas (events, products, tickets) use Drizzle table definitions with `createInsertSchema`/`createSelectSchema` from drizzle-zod. Types inferred via `z.infer<typeof schema>`.

### III. Service Layer Pattern ✅
- **Status**: PASS
- **Analysis**: New services follow convention: `tickets.service.ts` (extended for scanning), `participation.service.ts`, `photos.service.ts`. All use Drizzle ORM for queries, Zod schemas for validation. No raw SQL. Pagination uses existing `pagination.ts` utilities for cursor-based approaches if needed.

### IV. Qwik Framework Conventions ✅
- **Status**: PASS
- **Analysis**: 
  - Ticket scanning UI uses `component$()` pattern
  - Participation toggle uses `routeAction$()` with `zod$()` for mutations
  - Photo upload component uses `useSignal()` for reactive state
  - Photo gallery data loaded via `routeLoader$()`
  - **CRITICAL**: Most functionality uses Qwik server functions (routeAction$/routeLoader$), NOT REST APIs
  - Only one true REST API endpoint needed: `/api/photos/serve` for signed URL validation

### V. Component Organization ✅
- **Status**: PASS
- **Analysis**: New components in `src/components/events/`: `TicketScanner.tsx`, `ParticipationToggle.tsx`, `PhotoUploader.tsx`, `PhotoGallery.tsx`. Reusable UI primitives (Button, Card) from `src/components/ui/`. Use `<Slot />` for composition.

### VI. Type Safety Without Redundancy ✅
- **Status**: PASS
- **Analysis**: Types generated from Zod schemas (e.g., `Ticket`, `InsertTicket`, `EventPhoto`). Install `@types/qrcode` for qrcode package. No manual type duplication. Drizzle generates DB entity types automatically.

### VII. Fail Fast, Handle Gracefully ✅
- **Status**: PASS
- **Analysis**: 
  - Input validation via Zod schemas before DB operations (fail early)
  - Expected errors caught: QR validation failures, sales period violations, attendance check failures
  - Unexpected errors (DB failures, network issues) bubble to Qwik error boundaries
  - Server functions return structured `{success, data?, error?}` patterns
  - No indiscriminate try-catch wrapping

### Technology Stack Requirements ✅
- **Status**: PASS
- **Analysis**: Using mandated stack (Qwik 1.7+, Drizzle ORM 0.45+, Zod 4.2+, TypeScript 5.4+, Tailwind CSS, Biome). New packages (qrcode, html5-qrcode, @uppy/core) are additive, not replacements.

### Development Workflow ✅
- **Status**: PASS
- **Analysis**: 
  - Project structure: schemas in `src/db/schemas/`, services in `src/services/`, components in `src/components/events/`
  - File naming: PascalCase components, kebab-case services
  - Breaking changes allowed: extend schemas without backward compat concerns
  - No premature documentation beyond inline comments for complex logic

**GATE RESULT**: ✅ **PASS** - All constitution principles satisfied. Proceed to Phase 0.

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
├── components/
│   ├── events/              # NEW: Event-specific feature components
│   │   ├── TicketScanner.tsx
│   │   ├── ParticipationToggle.tsx
│   │   ├── PhotoUploader.tsx
│   │   └── PhotoGallery.tsx
│   └── ui/                  # Existing: Reusable UI primitives
│
├── db/
│   ├── schemas/
│   │   ├── events.ts        # EXTENDED: +salesStartDate, +salesEndDate
│   │   ├── products.ts      # EXTENDED: +participantCapacity
│   │   ├── tickets.ts       # EXTENDED: +isFree, +scannedAt
│   │   ├── ticket-participants.ts  # NEW
│   │   ├── participation-status.ts # NEW
│   │   └── event-photos.ts         # NEW
│   └── schema.ts            # EXTENDED: Export new schemas
│
├── services/
│   ├── tickets.service.ts   # EXTENDED: Add scan/validation methods
│   ├── participation.service.ts  # NEW
│   └── photos.service.ts         # NEW
│
├── utils/
│   ├── qr-code.ts           # NEW: QR generation/validation
│   └── secure-urls.ts       # NEW: HMAC URL signing
│
├── routes/
│   ├── events/[id]/
│   │   └── index.tsx        # EXTENDED: Add participation toggle, photo gallery
│   ├── admin/events/[id]/
│   │   ├── scan/index.tsx   # NEW: Ticket scanning interface
│   │   └── photos/index.tsx # NEW: Photo upload interface
│   └── api/
│       └── photos/
│           └── serve/       # NEW: Only true REST endpoint (signed URL serving)
│
└── env.ts                   # EXTENDED: +PHOTO_URL_SECRET

tests/
├── unit/
│   ├── qr-code.test.ts
│   ├── secure-urls.test.ts
│   └── services/
│       ├── participation.test.ts
│       └── photos.test.ts
├── integration/
│   ├── ticket-scan.test.ts
│   └── photo-access.test.ts
└── e2e/
    └── participation-flow.test.ts
```

**Structure Decision**: Single web application structure (existing pattern). New feature components in `src/components/events/` for domain separation. Services layer extends existing pattern. Only one new REST API endpoint (`/api/photos/serve`) - all other interactions use Qwik server functions via `routeAction$` and `routeLoader$` in route files.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| [e.g., 4th project] | [current need] | [why 3 projects insufficient] |
| [e.g., Repository pattern] | [specific problem] | [why direct DB access insufficient] |
