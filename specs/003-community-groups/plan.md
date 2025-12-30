# Implementation Plan: Community Groups

**Branch**: `003-community-groups` | **Date**: 2025-12-30 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/003-community-groups/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

Implement a community groups feature that enables platform admins to create local community organizations, users to join groups, and community representatives to manage group-specific content (posts and events) with configurable visibility (group-only or global). The system enforces role-based access control, requires group membership for event participation, and uses soft deletes to preserve user engagement data while hiding deleted content from all interfaces.

## Technical Context

**Language/Version**: TypeScript 5.4+ (strict mode)  
**Primary Dependencies**: Qwik 1.7+ with Qwik City, Drizzle ORM 0.45+, Zod 4.2+  
**Storage**: SQLite (development) with soft delete support for content  
**Testing**: Existing test infrastructure (no new tools required)  
**Target Platform**: Web application (server-side rendering with Qwik)
**Project Type**: Web application (existing Qwik City structure)  
**Performance Goals**: <200ms response time for group operations, <3 seconds for join actions  
**Constraints**: Role-based access control enforcement, 100% accuracy on content visibility rules  
**Scale/Scope**: Multiple groups per community, unlimited group memberships per user, soft delete retention

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### ✅ I. Centralized Configuration
- All environment variables already centralized in `src/env.ts` with Zod validation
- No new environment variables required for this feature

### ✅ II. Schema-Driven Database Design
- Will define new schemas in `src/db/schemas/` following Drizzle + Zod pattern:
  - `groups.ts` - Group entity with location coordinates
  - `group-memberships.ts` - User-to-group membership links
  - `group-representatives.ts` - Representative role assignments
- Will extend existing `posts.ts` and `events.ts` schemas to add:
  - `groupId` foreign key (nullable)
  - `visibility` enum field (group-only | global)
  - `deletedAt` timestamp for soft deletes
  - `deletedBy` user reference for audit trail
- All schemas will use `createInsertSchema`/`createSelectSchema` from drizzle-zod

### ✅ III. Service Layer Pattern
- Will create service modules in `src/services/`:
  - `groups.service.ts` - Group CRUD operations
  - `group-memberships.service.ts` - Join/leave operations
  - `group-representatives.service.ts` - Role management
- Will extend existing services:
  - `posts.service.ts` - Add group filtering and visibility checks
  - `events.service.ts` - Add group membership validation for participation
- All services will validate inputs using Zod schemas
- Cursor-based pagination using existing `pagination.ts` utilities

### ✅ IV. Qwik Framework Conventions
- Will use `component$()` for all new UI components
- Will use `routeLoader$()` for group data loading
- Will use `routeAction$()` with `zod$()` for join actions and content creation
- Routes will follow Qwik City structure:
  - `/routes/admin/groups/` - Platform admin group management
  - `/routes/groups/[groupId]/` - Public group pages
  - `/routes/groups/[groupId]/admin/` - Community representative area
- Will use `useSignal()` for reactive state in components

### ✅ V. Component Organization
- Will place reusable components in `src/components/`:
  - `src/components/groups/` - Group-specific components (GroupCard, MemberList, etc.)
  - Will extend existing `src/components/ui/` primitives as needed
- Components will use `<Slot />` for composition

### ✅ VI. Type Safety Without Redundancy
- Will generate all types from Zod schemas using `z.infer<typeof schema>`
- No manual type definitions required
- Will leverage Drizzle's generated types for database entities

### ✅ VII. Fail Fast, Handle Gracefully
- Will validate group membership before allowing event joins (expected error)
- Will validate representative permissions before content operations (expected error)
- Will validate coordinate ranges in schema (fail early)
- Will NOT wrap database operations in try-catch unless handling specific expected errors
- Will let unexpected errors bubble up to Qwik error boundaries

### 📋 Violations Requiring Justification

**None** - This feature aligns with all constitution principles and requires no violations.

---

### ✅ Post-Design Re-evaluation (Phase 1 Complete)

**Date**: 2025-12-30

All design artifacts have been generated and reviewed:
- ✅ research.md: All technical decisions align with constitution
- ✅ data-model.md: Schema-driven design using Drizzle + Zod
- ✅ contracts/api-contracts.md: Route actions follow Qwik City patterns
- ✅ quickstart.md: Implementation steps follow service layer and component organization principles

**Conclusion**: No constitution violations introduced during design phase. All principles remain satisfied. Ready to proceed to Phase 2 (Tasks generation).

## Project Structure

### Documentation (this feature)

```text
specs/003-community-groups/
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
│   ├── connection.ts           # Existing database connection
│   ├── schema.ts               # Schema aggregator (will export new schemas)
│   └── schemas/
│       ├── groups.ts           # NEW: Group entity
│       ├── group-memberships.ts # NEW: User-group membership links
│       ├── group-representatives.ts # NEW: Representative role assignments
│       ├── posts.ts            # MODIFIED: Add groupId, visibility, soft delete
│       ├── events.ts           # MODIFIED: Add groupId, visibility, soft delete
│       └── users.ts            # Existing (no changes required)
├── services/
│   ├── groups.service.ts       # NEW: Group CRUD operations
│   ├── group-memberships.service.ts # NEW: Membership management
│   ├── group-representatives.service.ts # NEW: Representative role management
│   ├── posts.service.ts        # MODIFIED: Add visibility filtering
│   └── events.service.ts       # MODIFIED: Add membership validation
├── components/
│   └── groups/                 # NEW: Group-specific components
│       ├── GroupCard.tsx
│       ├── GroupHeader.tsx
│       ├── MemberList.tsx
│       └── GroupAdminNav.tsx
├── routes/
│   ├── admin/
│   │   └── groups/             # NEW: Platform admin group management
│   │       ├── index.tsx       # List groups
│   │       ├── new/
│   │       │   └── index.tsx   # Create group
│   │       └── [groupId]/
│   │           └── edit/
│   │               └── index.tsx # Edit group
│   └── groups/
│       ├── index.tsx           # NEW: Browse groups
│       └── [groupId]/
│           ├── index.tsx       # NEW: Group details page
│           └── admin/          # NEW: Community representative area
│               ├── index.tsx   # Dashboard
│               ├── members/
│               │   └── index.tsx # Member list
│               ├── posts/
│               │   └── index.tsx # Manage posts
│               └── events/
│                   └── index.tsx # Manage events
└── utils/
    └── access-control.ts       # NEW: Role-based permission utilities
```

**Structure Decision**: This is a web application using the existing Qwik City file-based routing structure. New functionality is integrated into existing `src/` directories following established patterns. Group-related routes are organized under `/groups/` for public access and `/admin/groups/` for platform admin access, with `/groups/[groupId]/admin/` for community representatives.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

No violations - this section intentionally left empty.
