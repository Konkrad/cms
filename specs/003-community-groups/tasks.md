# Tasks: Community Groups

**Input**: Design documents from `/specs/003-community-groups/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: Tests are OPTIONAL and not included in this implementation - only if explicitly requested.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `- [ ] [ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- Single Qwik project: `src/` at repository root
- Paths assume single project structure per plan.md

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure

- [ ] T001 Review constitution compliance in specs/003-community-groups/plan.md
- [ ] T002 Review existing database schema patterns in src/db/schemas/

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core database schema and service infrastructure that MUST be complete before ANY user story

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

### Database Schema

- [ ] T003 [P] Create groups table schema with slug generation in src/db/schemas/groups.ts
- [ ] T004 [P] Create group_memberships table schema in src/db/schemas/group-memberships.ts
- [ ] T005 [P] Create group_representatives table schema in src/db/schemas/group-representatives.ts
- [ ] T006 [P] Extend posts schema with group_id, visibility, deleted_at, deleted_by in src/db/schemas/posts.ts
- [ ] T007 [P] Extend events schema with group_id, visibility, deleted_at, deleted_by in src/db/schemas/events.ts
- [ ] T008 Update schema aggregator to export new schemas in src/db/schema.ts
- [ ] T009 Generate and apply database migration using drizzle-kit

### Service Layer & Utilities

- [ ] T010 [P] Create groups service in src/services/groups.service.ts
- [ ] T011 [P] Create group-memberships service in src/services/group-memberships.service.ts
- [ ] T012 [P] Create group-representatives service in src/services/group-representatives.service.ts
- [ ] T013 [P] Create access control utilities in src/utils/access-control.ts
- [ ] T014 [P] Create group slug utilities in src/utils/group-slug.ts
- [ ] T015 Extend posts service with visibility filtering and soft delete in src/services/posts.service.ts
- [ ] T016 Extend events service with visibility filtering, soft delete, and membership check in src/services/events.service.ts

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 2 - Platform Admin Creates and Manages Groups (Priority: P1) 🎯 MVP

**Goal**: Enable platform administrators to create community groups with location data and edit group details

**Independent Test**: Login as platform admin, create a group with name and coordinates, edit the group, verify changes persist and slug is generated correctly

### Implementation for User Story 2

- [ ] T017 [US2] Create root admin layout with role detection in src/routes/admin/layout.tsx
- [ ] T018 [US2] Create global admin layout guard in src/routes/admin/global/layout.tsx
- [ ] T019 [P] [US2] Create admin groups list route in src/routes/admin/global/groups/index.tsx
- [ ] T020 [P] [US2] Create group creation route in src/routes/admin/global/groups/new/index.tsx
- [ ] T021 [P] [US2] Create group edit route in src/routes/admin/global/groups/[id]/edit/index.tsx
- [ ] T022 [P] [US2] Create GroupCard component in src/components/groups/GroupCard.tsx
- [ ] T023 [US2] Update admin navigation to include global groups link

**Checkpoint**: Platform admins can create and manage groups independently with correct URL structure

---

## Phase 4: User Story 1 - User Joins Community Group (Priority: P1)

**Goal**: Enable regular users to discover and join community groups

**Independent Test**: Create a group as admin, login as regular user, view group details, click join button, verify membership

### Implementation for User Story 1

- [ ] T024 [P] [US1] Create groups listing route in src/routes/groups/index.tsx
- [ ] T025 [P] [US1] Create group details route with join action in src/routes/groups/[slug]/index.tsx
- [ ] T026 [P] [US1] Create GroupHeader component in src/components/groups/GroupHeader.tsx
- [ ] T027 [US1] Add user profile groups view integration

**Checkpoint**: Users can discover and join groups independently

---

## Phase 5: User Story 3 - Platform Admin Promotes Members to Representatives (Priority: P2)

**Goal**: Enable platform admins to promote group members to community representatives

**Independent Test**: Create group, have user join, login as admin, promote user to representative, verify representative can access group admin area

### Implementation for User Story 3

- [ ] T028 [US3] Create group members management route in src/routes/admin/global/groups/[id]/members/index.tsx
- [ ] T029 [US3] Implement promote member action in members route
- [ ] T030 [US3] Create MemberList component in src/components/admin/global/MemberList.tsx

**Checkpoint**: Admins can promote members and representatives gain access

---

## Phase 6: User Story 4 - Community Representative Creates Group Content (Priority: P2)

**Goal**: Enable representatives to create posts and events scoped to their groups with visibility control

**Independent Test**: Login as representative, create group-only post, verify only members see it, create global event, verify all users see it

### Implementation for User Story 4

- [ ] T031 [US4] Create group admin layout with representative guard in src/routes/admin/[group_slug]/layout.tsx
- [ ] T032 [US4] Create group admin dashboard route in src/routes/admin/[group_slug]/index.tsx
- [ ] T033 [P] [US4] Create group posts list route in src/routes/admin/[group_slug]/posts/index.tsx
- [ ] T034 [P] [US4] Create group post creation route in src/routes/admin/[group_slug]/posts/new/index.tsx
- [ ] T035 [P] [US4] Create group post edit route in src/routes/admin/[group_slug]/posts/[id]/edit/index.tsx
- [ ] T036 [P] [US4] Create group events list route in src/routes/admin/[group_slug]/events/index.tsx
- [ ] T037 [P] [US4] Create group event creation route in src/routes/admin/[group_slug]/events/new/index.tsx
- [ ] T038 [P] [US4] Create group event edit route in src/routes/admin/[group_slug]/events/[id]/edit/index.tsx
- [ ] T039 [P] [US4] Create event details route in src/routes/admin/[group_slug]/events/[id]/details/index.tsx
- [ ] T040 [P] [US4] Create event attendance route in src/routes/admin/[group_slug]/events/[id]/attendance/index.tsx
- [ ] T041 [P] [US4] Create event tickets route in src/routes/admin/[group_slug]/events/[id]/tickets/index.tsx
- [ ] T042 [P] [US4] Create event participation route in src/routes/admin/[group_slug]/events/[id]/participation/index.tsx
- [ ] T043 [P] [US4] Create event photos route in src/routes/admin/[group_slug]/events/[id]/photos/index.tsx
- [ ] T044 [P] [US4] Create GroupAdminNav component in src/components/admin/group/GroupAdminNav.tsx
- [ ] T045 [US4] Add visibility selector component for posts and events
- [ ] T046 [US4] Implement soft delete for posts in group admin routes
- [ ] T047 [US4] Implement soft delete for events in group admin routes

**Checkpoint**: Representatives can create and manage group content with proper visibility control using /admin/[group_slug]/* routes

---

## Phase 7: User Story 5 - User Joins Group Event (Priority: P3)

**Goal**: Enable group members to join events while enforcing membership requirements

**Independent Test**: Create group event, verify non-member cannot join, join group, verify member can now join event

### Implementation for User Story 5

- [ ] T048 [US5] Update event join action to check group membership in event routes
- [ ] T049 [US5] Update event detail page to display membership requirement in src/routes/events/[id]/index.tsx
- [ ] T050 [US5] Add error messaging for non-member join attempts

**Checkpoint**: Event participation correctly enforces group membership

---

## Phase 8: User Story 6 - Community Representative Manages Group Members (Priority: P3)

**Goal**: Enable representatives to view their group's membership list

**Independent Test**: Login as representative, view members list, verify all members shown with join dates

### Implementation for User Story 6

- [ ] T051 [US6] Create group members view route in src/routes/admin/[group_slug]/users/index.tsx
- [ ] T052 [US6] Implement member search/filter functionality

**Checkpoint**: Representatives can view and manage their group members

---

## Phase 9: Admin Route Migration & URL Structure

**Purpose**: Reorganize existing admin routes to new /admin/global/* structure

- [ ] T053 Move existing event admin routes to src/routes/admin/global/events/[id]/index.tsx
- [ ] T054 Move existing user admin routes to src/routes/admin/global/users/index.tsx
- [ ] T055 Move existing page admin routes to src/routes/admin/global/pages/index.tsx
- [ ] T056 Add site admin guard to pages route in layout
- [ ] T057 Update all internal admin route references to use /admin/global/* prefix

**Checkpoint**: Clean URL structure with /admin/global/* for platform admins and /admin/{group_slug}/* for representatives

---

## Phase 10: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [ ] T058 [P] Create Breadcrumbs component in src/components/admin/Breadcrumbs.tsx
- [ ] T059 [P] Create global AdminNav component with role-based menu items in src/components/admin/AdminNav.tsx
- [ ] T060 [P] Add database indexes for performance optimization
- [ ] T061 [P] Create group posts public feed route in src/routes/groups/[slug]/posts/index.tsx
- [ ] T062 [P] Create group events public list route in src/routes/groups/[slug]/events/index.tsx
- [ ] T063 Update documentation with new URL structure
- [ ] T064 Run validation tests from specs/003-community-groups/quickstart.md
- [ ] T065 Security audit for role-based access control in all layouts
- [ ] T066 Test soft delete filtering across all queries
- [ ] T067 Verify slug generation and uniqueness validation

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3-8)**: All depend on Foundational phase completion
  - User stories can proceed in parallel (if staffed)
  - Or sequentially in priority order (P1 → P2 → P3)
- **Route Migration (Phase 9)**: Can be done in parallel with user story phases
- **Polish (Phase 10)**: Depends on all user stories being complete

### User Story Dependencies

- **User Story 2 (P1)**: Can start after Foundational - No dependencies
- **User Story 1 (P1)**: Can start after Foundational - No dependencies (but more valuable after US2)
- **User Story 3 (P2)**: Depends on US1 and US2 (needs groups and members)
- **User Story 4 (P2)**: Depends on US3 (needs representatives)
- **User Story 5 (P3)**: Depends on US1 and US4 (needs membership and events)
- **User Story 6 (P3)**: Depends on US3 (needs representatives)

### Within Each User Story

- Layouts before routes
- Services before routes
- Core functionality before UI components
- Story complete before moving to next priority

### Parallel Opportunities

- All Foundational schema tasks (T003-T007) can run in parallel
- All Foundational service/utility tasks (T010-T014) can run in parallel
- Within US2: T019, T020, T021, T022 can run in parallel (after layouts)
- Within US1: T024, T025, T026 can run in parallel
- Within US4: T033-T043 (all route files) can run in parallel after T031 layout
- Within US4: T044 component can run in parallel with routes
- Polish tasks T058, T059, T060, T061, T062 can run in parallel

---

## Parallel Example: User Story 4

```bash
# After creating the group admin layout (T031), launch all route tasks together:
Task: "Create group posts list route in src/routes/admin/[group_slug]/posts/index.tsx"
Task: "Create group post creation route in src/routes/admin/[group_slug]/posts/new/index.tsx"
Task: "Create group post edit route in src/routes/admin/[group_slug]/posts/[id]/edit/index.tsx"
Task: "Create group events list route in src/routes/admin/[group_slug]/events/index.tsx"
Task: "Create group event creation route in src/routes/admin/[group_slug]/events/new/index.tsx"
Task: "Create group event edit route in src/routes/admin/[group_slug]/events/[id]/edit/index.tsx"
Task: "Create event details route in src/routes/admin/[group_slug]/events/[id]/details/index.tsx"
Task: "Create event attendance route in src/routes/admin/[group_slug]/events/[id]/attendance/index.tsx"
Task: "Create event tickets route in src/routes/admin/[group_slug]/events/[id]/tickets/index.tsx"
Task: "Create event participation route in src/routes/admin/[group_slug]/events/[id]/participation/index.tsx"
Task: "Create event photos route in src/routes/admin/[group_slug]/events/[id]/photos/index.tsx"
Task: "Create GroupAdminNav component in src/components/admin/group/GroupAdminNav.tsx"
```

---

## Implementation Strategy

### MVP First (User Stories 1 & 2 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL)
3. Complete Phase 3: User Story 2 (Admin creates groups)
4. Complete Phase 4: User Story 1 (Users join groups)
5. **STOP and VALIDATE**: Test group creation and joining independently
6. Deploy/demo if ready

### Incremental Delivery

1. Setup + Foundational → Foundation ready
2. Add US2 + US1 → Test independently → Deploy (MVP: Groups exist and users can join!)
3. Add US3 → Test independently → Deploy (Representatives can be promoted)
4. Add US4 → Test independently → Deploy (Representatives can create content with /admin/{slug}/* routes)
5. Add US5 + US6 → Test independently → Deploy (Full feature set)
6. Route Migration (Phase 9) → Update existing admin routes
7. Polish phase → Final deployment

### Parallel Team Strategy

With multiple developers:

1. Team completes Setup + Foundational together
2. Once Foundational is done:
   - Developer A: User Story 2 (admin group management)
   - Developer B: User Story 1 (user join flow)
   - Developer C: Phase 9 (route migration)
3. After US1+US2 complete:
   - Developer A: User Story 3 (promote representatives)
   - Developer B: User Story 4 (representative content creation)
4. After US3+US4 complete:
   - Developer A: User Story 6 (member management)
   - Developer B: User Story 5 (event participation)

---

## URL Structure Reference

### Global Admin Routes (`/admin/global/*`)
- `/admin/global/groups` - List all groups
- `/admin/global/groups/new` - Create new group
- `/admin/global/groups/[id]/edit` - Edit group details
- `/admin/global/groups/[id]/members` - Manage members & promote representatives
- `/admin/global/events/[id]` - Global event management
- `/admin/global/users` - User management
- `/admin/global/pages` - **SITE ADMINS ONLY**: Page management

### Group Admin Routes (`/admin/{group_slug}/*`)
- `/admin/paris/` - Paris group dashboard
- `/admin/paris/events` - List Paris events
- `/admin/paris/events/new` - Create Paris event
- `/admin/paris/events/[id]/edit` - Edit Paris event
- `/admin/paris/events/[id]/details` - Event details
- `/admin/paris/events/[id]/attendance` - Attendance tracking
- `/admin/paris/events/[id]/tickets` - Ticket management
- `/admin/paris/events/[id]/participation` - Participation
- `/admin/paris/events/[id]/photos` - Event photos
- `/admin/paris/posts` - List Paris posts
- `/admin/paris/posts/new` - Create Paris post
- `/admin/paris/posts/[id]/edit` - Edit Paris post
- `/admin/paris/users` - View Paris members

### Public Group Routes
- `/groups` - Browse all groups
- `/groups/[slug]` - Group detail page
- `/groups/[slug]/posts` - Group posts feed
- `/groups/[slug]/events` - Group events list

---

## Notes

- [P] tasks = different files, no dependencies, can run in parallel
- [Story] label maps task to specific user story (US1, US2, etc.)
- Each user story should be independently completable and testable
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- **NEW URL STRUCTURE**: 
  - `/admin/global/*` for platform admins (site-wide management)
  - `/admin/{group_slug}/*` for community representatives (group-scoped management)
- Slug format: lowercase with underscores (e.g., "Paris" → "paris", "New York" → "new_york")
- All content queries MUST filter `WHERE deleted_at IS NULL`
- Verify access control at layout level before implementing routes
- Layout hierarchy: admin/layout.tsx → admin/global/layout.tsx OR admin/[group_slug]/layout.tsx

---

## Task Summary

**Total Tasks**: 67

### By Phase:
- Phase 1 (Setup): 2 tasks
- Phase 2 (Foundational): 14 tasks (BLOCKING)
- Phase 3 (US2 - Admin Creates Groups): 7 tasks
- Phase 4 (US1 - User Joins Groups): 4 tasks
- Phase 5 (US3 - Promote Representatives): 3 tasks
- Phase 6 (US4 - Representative Content): 17 tasks
- Phase 7 (US5 - Join Events): 3 tasks
- Phase 8 (US6 - Member Management): 2 tasks
- Phase 9 (Route Migration): 5 tasks
- Phase 10 (Polish): 10 tasks

### By User Story:
- US1 (User Joins Group): 4 tasks
- US2 (Admin Creates Groups): 7 tasks
- US3 (Promote Representatives): 3 tasks
- US4 (Representative Content): 17 tasks
- US5 (Join Events): 3 tasks
- US6 (Member Management): 2 tasks
- Infrastructure/Foundational: 16 tasks
- Migration/Polish: 15 tasks

### Parallel Opportunities:
- 35 tasks marked with [P] can run in parallel within their phase
- All user stories can be worked on in parallel after Foundational phase

### MVP Scope (Recommended):
- Phase 1 + Phase 2 + Phase 3 (US2) + Phase 4 (US1) = 27 tasks
- Delivers: Group creation by admins + User joining capability
