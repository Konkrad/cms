# Implementation Plan: Event Participation Tracking & Enhanced Features

**Branch**: `002-event-participation-tracking` | **Date**: 2025-12-29 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/002-event-participation-tracking/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

Enhance the events system with participation tracking, sales period configuration, private event photos (using Uppy.io v5 for upload UI, existing upload endpoint for optimization, storing under /private/ path), free tickets, and ticket scanning for attendance verification. The system will leverage existing upload infrastructure while adding secure photo access controls and multi-participant product capacity.

## Technical Context

**Language/Version**: TypeScript 5.4+ (strict mode), Qwik 1.7+  
**Primary Dependencies**: Qwik City (routing/SSR), Drizzle ORM 0.45+, Zod 4.2+, Tailwind CSS 3.4+, Biome 2.3+, Uppy.io v5 (photo upload), NEEDS CLARIFICATION (QR code generation library), NEEDS CLARIFICATION (QR code scanning library), NEEDS CLARIFICATION (secure URL generation method)  
**Storage**: SQLite (development, local files for photos under /private/ path), existing upload endpoint for photo optimization (converts to webp), NEEDS CLARIFICATION (secure photo URL token mechanism)  
**Testing**: NEEDS CLARIFICATION (existing test framework - Vitest? Jest? Playwright?)  
**Target Platform**: Web application (SSR with Qwik)
**Project Type**: Web application (existing monolith structure)  
**Performance Goals**: Ticket scanning <2s per scan with real-time feedback, photo upload handling 500+ photos, secure URL generation <500ms, page loads <1s (Qwik resumability)  
**Constraints**: Real-time internet required for ticket scanning validation, secure photo URLs expire in 1 hour, must integrate with existing event/ticket/product schemas  
**Scale/Scope**: Support 100+ events simultaneously, 1000+ tickets per event, 500+ photos per event, multi-participant products (capacity up to 10 participants)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### ✅ I. Centralized Configuration
- Photo upload settings (Uppy config, /private/ path, upload endpoint) centralized in environment config
- No new environment variables needed - reusing existing upload infrastructure
- **Post-Design**: Confirmed no environment changes required

### ✅ II. Schema-Driven Database Design
- Extended existing `events`, `tickets`, `products` schemas following Drizzle ORM patterns
- Created new schemas: `eventPhotos`, `participationStatus`, `ticketParticipants` with proper relations
- Used `createInsertSchema`/`createSelectSchema` from `drizzle-zod` for validation
- **Post-Design**: All schemas documented in data-model.md with proper validation rules

### ✅ III. Service Layer Pattern
- Created new services: `tickets.service.ts`, `photos.service.ts`, `participation.service.ts`
- Extended existing `events.service.ts` for sales period validation
- All services follow existing pattern (single export object with methods)
- **Post-Design**: Service interfaces defined in quickstart.md

### ✅ IV. Qwik Framework Conventions
- Used `routeLoader$()` for photo gallery and ticket data loading
- Used `routeAction$()` with `zod$()` for ticket scanning, participation updates
- Uppy.io v5 integration uses Qwik's `component$()` pattern for client-side upload UI
- **Post-Design**: Component patterns confirmed in quickstart.md

### ✅ V. Component Organization
- Photo upload component in `src/components/events/PhotoUploader.tsx` (feature-specific)
- Ticket scanner in `src/components/events/TicketScanner.tsx` (feature-specific)
- Participation toggle in `src/components/events/ParticipationToggle.tsx` (feature-specific)
- Photo gallery in `src/components/events/PhotoGallery.tsx` (feature-specific)
- Reuses existing UI primitives from `src/components/ui/`
- **Post-Design**: Component structure documented in project structure section

### ✅ VI. Type Safety Without Redundancy
- All types generated from Zod schemas via `z.infer<typeof schema>`
- Installed `@types/qrcode` for QR code library types (html5-qrcode has built-in types)
- No manual type duplication
- **Post-Design**: Type generation patterns confirmed in schema definitions

### ✅ VII. Fail Fast, Handle Gracefully
- QR code validation fails fast with clear error messages (signature mismatch)
- Photo access control validates attendance before URL generation (403 for non-attendees)
- Sales period validation prevents purchases outside window at route action level
- Expected errors (validation, not found, unauthorized) handled gracefully with structured responses
- Unexpected errors bubble up for debugging
- **Post-Design**: Error handling patterns documented in API contracts

**GATE STATUS**: ✅ PASSED - No constitution violations after design phase. Feature fully aligns with all principles.

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
│   ├── ui/                    # Reused UI primitives (Button, Card, Input, etc.)
│   └── events/                # New feature-specific components
│       ├── PhotoUploader.tsx  # Uppy.io v5 integration for photo upload
│       ├── PhotoGallery.tsx   # Private photo display with secure URLs
│       ├── TicketScanner.tsx  # QR code scanning interface
│       └── ParticipationToggle.tsx  # Yes/No/Maybe participation UI
│
├── db/
│   ├── schemas/
│   │   ├── events.ts          # Extended with salesStartDate, salesEndDate
│   │   ├── tickets.ts         # Extended with isFree field (scannedAt already exists)
│   │   ├── products.ts        # Extended with participantCapacity field
│   │   ├── event-photos.ts    # New: photo storage references
│   │   ├── participation-status.ts  # New: user participation intent
│   │   └── ticket-participants.ts   # New: multi-participant data per ticket
│   └── schema.ts              # Aggregator updated to export new schemas
│
├── services/
│   ├── tickets.service.ts     # Extended with scanning operations
│   ├── photos.service.ts      # New: photo upload, secure URL generation
│   ├── participation.service.ts  # New: participation status CRUD
│   └── events.service.ts      # Extended with sales period validation
│
├── routes/
│   ├── admin/
│   │   └── events/
│   │       └── [eventId]/
│   │           └── photos/
│   │               └── upload/  # Photo upload admin interface
│   ├── events/
│   │   └── [eventId]/
│   │       ├── photos/          # Private photo gallery (attendees only)
│   │       └── scan/            # Ticket scanning interface
│   └── api/
│       ├── photos/
│       │   └── [photoId]/
│       │       └── secure-url/  # Generate time-limited secure URLs
│       └── tickets/
│           └── scan/            # Ticket scanning endpoint
│
└── utils/
    ├── qr-code.ts               # QR code generation/validation utilities
    └── secure-urls.ts           # Time-limited URL generation/validation
```

**Structure Decision**: Extending existing monolith structure. New schemas added to `src/db/schemas/`, new services to `src/services/`, feature-specific components in `src/components/events/`. Leveraging existing upload infrastructure at `/private/` path with existing optimization endpoint.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| [e.g., 4th project] | [current need] | [why 3 projects insufficient] |
| [e.g., Repository pattern] | [specific problem] | [why direct DB access insufficient] |
