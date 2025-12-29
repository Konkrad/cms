# Implementation Plan: Event Participation Tracking & Enhanced Features

**Branch**: `002-event-participation-tracking` | **Date**: 2025-12-29 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/002-event-participation-tracking/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

Enhance the existing event management system with participation tracking, sales periods, private event photos, free tickets, and ticket scanning for attendance verification. The system already has a ticket scanning mechanism in place - we will adapt it slightly rather than rebuild. This feature extends the existing Qwik/SQLite/Drizzle stack with minimal new dependencies.

## Technical Context

**Language/Version**: TypeScript 5.4+ (strict mode), Node.js runtime  
**Primary Dependencies**: Qwik 1.7+, Qwik City (routing/SSR), Drizzle ORM 0.45+, Zod 4.2+ (validation)  
**Storage**: SQLite (development), potential Turso/libSQL (production), Drizzle migrations  
**Testing**: Existing test framework (to be determined from codebase)  
**Target Platform**: Web application (SSR + client hydration)
**Project Type**: Web application (Qwik-based monolith)  
**Performance Goals**: <200ms page load, real-time ticket scanning feedback (<1s), photo URL generation <500ms  
**Constraints**: Reuse existing ticket scanning system, secure photo storage with time-limited URLs, sales period validation  
**Scale/Scope**: Multiple events, hundreds of attendees per event, potentially thousands of private photos per event

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| **I. Centralized Configuration** | ✅ PASS | Will add photo storage config to `src/env.ts` |
| **II. Schema-Driven Database Design** | ✅ PASS | New schemas follow Drizzle + Zod pattern |
| **III. Service Layer Pattern** | ✅ PASS | Will create services for participants, photos, adapt existing tickets.service |
| **IV. Qwik Framework Conventions** | ✅ PASS | Using routeLoader$, routeAction$, component$ patterns |
| **V. Component Organization** | ✅ PASS | Components in `src/components/`, feature-specific if needed |
| **VI. Type Safety Without Redundancy** | ✅ PASS | Types generated from Zod schemas, no manual duplication |
| **VII. Fail Fast, Handle Gracefully** | ✅ PASS | Validate at boundaries, let unexpected errors bubble |

**Breaking Changes**: Yes - inventory table will gain sales period fields, events table may gain `isFree` flag. Existing ticket scanning system will be adapted.

**Constitution Compliance**: ✅ All principles aligned

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
│   ├── ui/                   # Existing UI primitives
│   └── events/               # Event-specific components (if needed)
├── db/
│   ├── connection.ts         # Existing database connection
│   ├── schema.ts             # Existing schema aggregator (update)
│   └── schemas/
│       ├── events.ts         # Update: add isFree field
│       ├── inventory-groups.ts  # Update: add salesStartDate, salesEndDate
│       ├── products.ts       # Update: add participantCapacity field
│       ├── tickets.ts        # Existing (already has scannedAt)
│       ├── participants.ts   # NEW: participant details (user-event mapping)
│       └── event-photos.ts   # NEW: private photos storage
├── routes/
│   ├── admin/
│   │   └── events/
│   │       └── [id]/
│   │           ├── photos/   # NEW: photo upload/management routes
│   │           └── participants/  # NEW: participant management
│   ├── api/
│   │   └── events/
│   │       └── [id]/
│   │           └── photos/   # NEW: secure photo URL generation
│   └── events/
│       └── [id]/
│           ├── index.tsx     # Update: add participation status UI
│           └── photos/       # NEW: attendee photo gallery
├── services/
│   ├── tickets.service.ts    # Existing (adapt scanTicket)
│   ├── participants.service.ts  # NEW: participant CRUD + status tracking
│   └── event-photos.service.ts  # NEW: photo upload, access control, URL generation
├── utils/
│   └── photo-storage.ts      # NEW: secure storage helpers (time-limited URLs)
└── env.ts                    # Update: add photo storage config

tests/
├── integration/
│   ├── ticket-scanning.test.ts      # Update existing
│   ├── participation-status.test.ts  # NEW
│   ├── sales-period.test.ts         # NEW
│   └── private-photos.test.ts       # NEW
└── unit/
    └── services/
        ├── participants.service.test.ts  # NEW
        └── event-photos.service.test.ts  # NEW
```

**Structure Decision**: Monolithic Qwik application structure. All features live in `src/` with domain-organized subdirectories. Tests mirror source structure. This follows the existing CMS architecture and constitution principles.

## Complexity Tracking

No constitution violations. All changes follow existing patterns.
