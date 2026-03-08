# Implementation Plan: Profile Improvements

**Branch**: `004-profile-improvements` | **Date**: 2026-03-08 | **Spec**: [spec.md](spec.md)  
**Input**: Feature specification from `/specs/004-profile-improvements/spec.md`

## Summary

Add public (authenticated) user profile pages at `/users/<shortId>-<name-slug>`, showing communities the user belongs to and events they attended or plan to attend. Update participant/member list components to link to those profiles. Email and birthdate are hidden from visiting members.

## Technical Context

**Language/Version**: TypeScript 5.4+ / Node 20  
**Primary Dependencies**: Qwik 1.7+, Qwik City, Drizzle ORM 0.45+, Zod 4.2+, Tailwind CSS 3.4+  
**Storage**: SQLite (Drizzle ORM) — `users`, `participation_status`, `group_memberships`, `events`, `groups`  
**Testing**: Playwright (E2E) at `tests/`  
**Target Platform**: SSR web application (Qwik City)  
**Project Type**: Web application — single Qwik City project  
**Performance Goals**: Page load consistent with existing profile/event routes (no new N+1 queries)  
**Constraints**: No schema migrations; no new API endpoints; auth-gated pages only; no backwards-compatible URL shims  
**Scale/Scope**: Community-sized user base (< 10 000 users); no pagination needed for profile sections

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Check | Notes |
|-----------|-------|-------|
| I. Centralized Configuration | ✅ PASS | No new env vars; existing `env.AWS_ENDPOINT`, `env.S3_BUCKET`, `env.AWS_REGION` used |
| II. Schema-Driven Database Design | ✅ PASS | No schema changes; all data exists |
| III. Service Layer Pattern | ✅ PASS | New methods added to existing service modules |
| IV. Qwik Framework Conventions | ✅ PASS | Route uses `routeLoader$()`, auth via `requireAuth` |
| V. Component Organization | ✅ PASS | New route in `src/routes/users/[userId]/`; extended components in existing files |
| VI. Type Safety Without Redundancy | ✅ PASS | Types derived from existing Drizzle/Zod schemas; no manual duplication |
| VII. Fail Fast | ✅ PASS | Only auth redirect and 404 are caught; no unnecessary try-catch |

**Privacy gate**: `email` and `yearOfBirth` are stripped in the loader before the payload is serialized — they never reach the browser for non-owners.

**Post-design re-check**: No violations. No new complexity gates required.

## Project Structure

### Documentation (this feature)

```text
specs/004-profile-improvements/
├── plan.md              # This file
├── spec.md              # Feature requirements and user stories
├── research.md          # Phase 0: design decisions and rationale
├── data-model.md        # Derived types, new service method signatures
├── quickstart.md        # Step-by-step implementation guide
├── contracts/
│   ├── users-profile-route.md        # Route loader contract
│   └── participant-data-interface.md # Interface extension contract
└── tasks.md             # Phase 2 output (not yet created)
```

### Source Code Changes

```text
src/
├── utils/
│   └── users.ts                          # Add buildProfileUrl (full UUID)
├── services/
│   ├── users.service.ts                  # No change — getById already exists
│   └── participation.service.ts          # Add getByUserId(userId)
├── components/
│   ├── page-blocks/FeatureBlock/
│   │   └── ParticipantsTile.tsx          # Extend ParticipantData with profileUrl?
│   └── events/
│       └── ParticipantsModal.tsx         # Add profile link on each row
└── routes/
    ├── users/
    │   └── [userId]/
    │       └── index.tsx                 # NEW — public profile page
    ├── events/
    │   └── [id]/
    │       └── index.tsx                 # Populate profileUrl in participants array
    └── groups/
        └── [slug]/
            └── index.tsx                 # Populate profileUrl in recentMembers + fix repData.profileUrl
```

**Structure Decision**: Single Qwik City project. New route follows the existing `src/routes/[entity]/[param]/index.tsx` pattern established by `events/[id]` and `groups/[slug]`.

## Complexity Tracking

No Constitution Check violations — section not applicable.
