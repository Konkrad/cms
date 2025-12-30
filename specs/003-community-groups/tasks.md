# Tasks: Community Groups

**Input**: Design documents from `/specs/003-community-groups/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Tests are OPTIONAL for this feature - no test tasks included per specification.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Database schema and core infrastructure for groups feature

- [ ] T001 Create groups schema in src/db/schemas/groups.ts with validation for lat/long coordinates
- [ ] T002 [P] Create group-memberships schema in src/db/schemas/group-memberships.ts with unique constraint on (user_id, group_id)
- [ ] T003 [P] Create group-representatives schema in src/db/schemas/group-representatives.ts with unique constraint and promoted_by audit trail
- [ ] T004 Add groupId, visibility, deletedAt, deletedBy fields to posts schema in src/db/schemas/posts.ts
- [ ] T005 [P] Add groupId, visibility, deletedAt, deletedBy fields to events schema in src/db/schemas/events.ts
- [ ] T006 Update schema aggregator in src/db/schema.ts to export new group schemas
- [ ] T007 Generate and apply database migrations using drizzle-kit
- [ ] T008 [P] Create groups service in src/services/groups.service.ts with CRUD operations
- [ ] T009 [P] Create group-memberships service in src/services/group-memberships.service.ts with join, isMember, getUserGroups methods
- [ ] T010 [P] Create group-representatives service in src/services/group-representatives.service.ts with promote, isRepresentative methods
- [ ] T011 Create access control utilities in src/utils/access-control.ts with canManageGroupContent, canViewGroupOnlyContent functions
- [ ] T012 Create group slug utilities in src/utils/group-slug.ts with generateSlug function
- [ ] T013 Update posts service in src/services/posts.service.ts to add soft delete support and visibility filtering (always filter deletedAt IS NULL)
- [ ] T014 Update events service in src/services/events.service.ts to add soft delete support, visibility filtering, and group membership validation for event joins

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [ ] T015 Create admin layout with access control in src/routes/admin/layout.tsx to detect platform admin vs group representative roles
- [ ] T016 Create admin navigation component in src/components/admin/AdminNav.tsx that switches between global and group contexts
- [ ] T017 Create breadcrumb component in src/components/admin/Breadcrumbs.tsx that handles both global and group-scoped routes

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 2 - Platform Admin Creates and Manages Groups (Priority: P1) 🎯 MVP

**Goal**: Platform administrators can create new community groups with name and location coordinates, and edit existing groups

**Independent Test**: Login as platform admin, create a new group with name "Test Group" and coordinates (48.8566, 2.3522), verify it appears in groups list, edit the name to "Paris Group", verify changes persist

### Implementation for User Story 2

- [ ] T018 [P] [US2] Create global admin layout in src/routes/admin/global/layout.tsx with platform admin guard (check user.role === 'admin')
- [ ] T019 [P] [US2] Create groups list page in src/routes/admin/global/groups/index.tsx with useAdminGroups loader
- [ ] T020 [US2] Create new group page in src/routes/admin/global/groups/new/index.tsx with useCreateGroup action and form using Zod validation
- [ ] T021 [US2] Create edit group page in src/routes/admin/global/groups/[id]/edit/index.tsx with useUpdateGroup action
- [ ] T022 [US2] Create group card component in src/components/groups/GroupCard.tsx for displaying group summary

**Checkpoint**: Platform admins can now create and manage groups. This enables all subsequent user stories.

---

## Phase 4: User Story 1 - User Joins Community Group (Priority: P1) 🎯 MVP

**Goal**: Regular users can discover groups and join them to access group-specific content

**Independent Test**: Create a group as admin, login as regular user, view group details, click join button, verify membership record created and user can now see group-only content

### Implementation for User Story 1

- [ ] T023 [P] [US1] Create groups list page in src/routes/groups/index.tsx with useGroups loader showing all groups
- [ ] T024 [P] [US1] Create group details page in src/routes/groups/[slug]/index.tsx with useGroup loader and useJoinGroup action
- [ ] T025 [US1] Create group header component in src/components/groups/GroupHeader.tsx with join button (conditional rendering)
- [ ] T026 [US1] Update groups service in src/services/groups.service.ts to add getBySlug method for slug-based lookup
- [ ] T027 [US1] Add user groups view in src/routes/profile/groups/index.tsx to show user's group memberships

**Checkpoint**: Users can now join groups and see their memberships. Group membership enables participation in group events.

---

## Phase 5: User Story 3 - Platform Admin Promotes Members to Representatives (Priority: P2)

**Goal**: Platform administrators can promote group members to community representatives, granting them group management permissions

**Independent Test**: Create a group, have a user join it, login as platform admin, navigate to group members page, promote the user to representative, verify they now have access to group admin area

### Implementation for User Story 3

- [ ] T028 [US3] Create group members management page in src/routes/admin/global/groups/[id]/members/index.tsx with useGroupMembers loader and usePromoteMember action
- [ ] T029 [US3] Create member list component in src/components/admin/MemberList.tsx showing members with promote button for non-representatives
- [ ] T030 [US3] Add representative badge/indicator in member list to show promoted users
- [ ] T031 [US3] Update access control utilities in src/utils/access-control.ts to verify promotion prerequisites (user must be member first)

**Checkpoint**: Platform admins can now promote members to representatives. This enables User Story 4 (community representatives creating content).

---

## Phase 6: User Story 4 - Community Representative Creates Group Content (Priority: P2)

**Goal**: Community representatives can create posts and events for their groups with group-only or global visibility

**Independent Test**: Login as community representative, access group admin area, create a post with group-only visibility, verify only group members see it; create event with global visibility, verify all users see it

### CRITICAL REFACTORING: Admin Routes for Both Global and Group Contexts

**Key Change**: The admin routes under src/routes/admin/[group_slug]/ will use a SINGLE implementation that works for BOTH global (when [group_slug] = "global") and group-specific contexts (when [group_slug] = specific group). This eliminates duplication.

### Implementation for User Story 4

- [ ] T032 [US4] Create group admin layout in src/routes/admin/[group_slug]/layout.tsx with conditional logic: if slug === "global" check platform admin role, else check group representative role for that group; load group context into sharedMap
- [ ] T033 [P] [US4] Refactor existing events list at src/routes/admin/events/index.tsx to src/routes/admin/[group_slug]/events/index.tsx with filtering based on group_slug parameter (global = all events, specific group = group events only)
- [ ] T034 [P] [US4] Refactor existing users list at src/routes/admin/users/index.tsx to src/routes/admin/[group_slug]/users/index.tsx with filtering based on group_slug (global = all users, specific group = group members only)
- [ ] T035 [P] [US4] Move pages management from src/routes/admin/pages/* to src/routes/admin/[group_slug]/pages/* (with guard: pages only accessible when group_slug === "global" AND user.role === 'site_admin')
- [ ] T036 [US4] Refactor event creation at src/routes/admin/events/new/index.tsx to src/routes/admin/[group_slug]/events/new/index.tsx adding group_id assignment based on group_slug and visibility selection field
- [ ] T037 [US4] Update event edit routes under src/routes/admin/events/[id]/* to src/routes/admin/[group_slug]/events/[id]/* (edit, details, attendance, tickets, participation, photos) with group_slug context
- [ ] T038 [US4] Refactor posts routes from src/routes/admin/posts/* to src/routes/admin/[group_slug]/posts/* with group_slug-based filtering
- [ ] T039 [US4] Add visibility selection component in src/components/admin/VisibilitySelector.tsx (radio buttons for "group-only" or "global")
- [ ] T040 [US4] Create group admin dashboard in src/routes/admin/[group_slug]/index.tsx showing group stats (member count, content count) or global stats when slug === "global"
- [ ] T041 [US4] Update posts service in src/services/posts.service.ts to add getVisiblePosts method that filters by user's group memberships and visibility settings
- [ ] T042 [US4] Update events service in src/services/events.service.ts to add getVisibleEvents method with same visibility filtering logic
- [ ] T043 [US4] Add soft delete actions to posts and events services (deletePost, deleteEvent methods that set deletedAt and deletedBy)
- [ ] T044 [US4] Update all existing admin routes to redirect from old paths (e.g., /admin/events → /admin/global/events, /admin/users → /admin/global/users)
- [ ] T045 [US4] Update AdminNav component in src/components/admin/AdminNav.tsx to generate navigation dynamically based on group_slug context

**Checkpoint**: Community representatives can now create and manage group content. Group-only content is properly filtered. Admin routes work seamlessly for both global and group contexts.

---

## Phase 7: User Story 5 - User Joins Group Event (Priority: P3)

**Goal**: Group members can join events organized by their groups; non-members are blocked from joining

**Independent Test**: Create group event as representative, login as group member, join the event successfully; login as non-member, verify join button shows "Join group first" message and prevents event join

### Implementation for User Story 5

- [ ] T046 [US5] Update event details page in src/routes/events/[id]/index.tsx to check group membership before showing join button
- [ ] T047 [US5] Update useJoinEvent action in events route to call membership validation in events service before creating participation record
- [ ] T048 [US5] Add group membership prompt component in src/components/events/GroupMembershipPrompt.tsx that displays when non-member views group event
- [ ] T049 [US5] Update events service joinEvent method in src/services/events.service.ts to validate group membership and return clear error messages

**Checkpoint**: Event participation now respects group membership. Non-members see helpful messages directing them to join groups first.

---

## Phase 8: User Story 6 - Community Representative Manages Group Members (Priority: P3)

**Goal**: Community representatives can view the list of members in their groups to understand and manage their community

**Independent Test**: Login as community representative, access group admin area, navigate to members section, verify seeing full list of group members with join dates and roles

### Implementation for User Story 6

- [ ] T050 [US6] Enhance member list in src/routes/admin/[group_slug]/users/index.tsx to show join dates, representative badges, and filter/search functionality
- [ ] T051 [US6] Add member statistics to group admin dashboard in src/routes/admin/[group_slug]/index.tsx (total members, new members this week, representatives count)
- [ ] T052 [US6] Create member card component in src/components/groups/MemberCard.tsx for consistent member display across admin views

**Checkpoint**: Community representatives have full visibility into their group membership and can track community growth.

---

## Phase 9: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [ ] T053 [P] Add database indexes on posts(group_id, deleted_at) and events(group_id, deleted_at) for query performance
- [ ] T054 [P] Add database indexes on group_memberships(user_id) and group_memberships(group_id)
- [ ] T055 Add error handling and user-friendly error messages across all group-related actions
- [ ] T056 [P] Update breadcrumbs component in src/components/admin/Breadcrumbs.tsx to handle group_slug dynamic segments
- [ ] T057 Verify all queries filter out soft-deleted content (deletedAt IS NULL check)
- [ ] T058 Add logging for critical operations (group creation, member promotion, content deletion)
- [ ] T059 [P] Create group admin navigation component in src/components/admin/group/GroupAdminNav.tsx
- [ ] T060 Validate quickstart scenarios from specs/003-community-groups/quickstart.md
- [ ] T061 Update documentation with final route structure and access control patterns

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Story 2 (Phase 3)**: Depends on Foundational - Creates groups (required for all other stories)
- **User Story 1 (Phase 4)**: Depends on US2 completion - Requires groups to exist before users can join
- **User Story 3 (Phase 5)**: Depends on US1 completion - Requires users to be members before promotion
- **User Story 4 (Phase 6)**: Depends on US3 completion - Requires representatives to exist before they can create content
- **User Story 5 (Phase 7)**: Depends on US4 completion - Requires group events to exist before users can join them
- **User Story 6 (Phase 8)**: Depends on US1 completion - Requires members to exist before representatives can view them
- **Polish (Phase 9)**: Depends on all user stories being complete

### Critical Path for MVP

MVP = User Story 2 (admin creates groups) + User Story 1 (users join groups)

1. Complete Phase 1: Setup (database schema + services)
2. Complete Phase 2: Foundational (admin layouts + navigation)
3. Complete Phase 3: User Story 2 (group creation by admins)
4. Complete Phase 4: User Story 1 (user joins group)
5. **STOP and VALIDATE**: Test that admins can create groups and users can join them

### User Story Dependencies

```
Phase 1 (Setup) → Phase 2 (Foundational) → Phase 3 (US2: Admin creates groups)
                                                ↓
                                            Phase 4 (US1: Users join groups)
                                                ↓
                                     ┌──────────┴──────────┐
                                     ↓                     ↓
                          Phase 5 (US3: Promote)    Phase 8 (US6: View members)
                                     ↓
                          Phase 6 (US4: Create content)
                                     ↓
                          Phase 7 (US5: Join events)
                                     ↓
                          Phase 9 (Polish)
```

### Parallel Opportunities

- Within Phase 1 Setup: T002, T003, T005, T008, T009, T010 can run in parallel
- Within Phase 3 (US2): T018 and T019 can run in parallel
- Within Phase 4 (US1): T023 and T024 can run in parallel
- Within Phase 6 (US4): T033, T034, T035, T038 can run in parallel (different route files)
- Within Phase 9 Polish: T053, T054, T056, T059 can run in parallel

---

## Parallel Example: Phase 1 Setup

```bash
# Launch all schema creation tasks together:
Task T001: "Create groups schema in src/db/schemas/groups.ts"
Task T002: "Create group-memberships schema in src/db/schemas/group-memberships.ts"
Task T003: "Create group-representatives schema in src/db/schemas/group-representatives.ts"

# After schemas done, launch all service creation together:
Task T008: "Create groups service in src/services/groups.service.ts"
Task T009: "Create group-memberships service in src/services/group-memberships.service.ts"
Task T010: "Create group-representatives service in src/services/group-representatives.service.ts"
```

---

## Implementation Strategy

### MVP First (US2 + US1 Only)

1. Complete Phase 1: Setup (database + services)
2. Complete Phase 2: Foundational (admin infrastructure)
3. Complete Phase 3: User Story 2 (admin creates groups)
4. Complete Phase 4: User Story 1 (users join groups)
5. **STOP and VALIDATE**: Test independently
6. Deploy/demo MVP

### Incremental Delivery

1. Setup + Foundational → Foundation ready
2. Add US2 (Admin creates groups) → Deploy/Demo
3. Add US1 (Users join) → Deploy/Demo (MVP complete!)
4. Add US3 (Promote representatives) → Deploy/Demo
5. Add US4 (Representatives create content) → Deploy/Demo
6. Add US5 (Users join events) → Deploy/Demo
7. Add US6 (View members) → Deploy/Demo
8. Polish → Final release

### Parallel Team Strategy

With multiple developers:

1. All complete Setup + Foundational together
2. Developer A: US2 (Admin creates groups)
3. Developer B: Can start on US1 components after US2 creates first group
4. After US2 + US1 complete:
   - Developer A: US3 (Promote representatives)
   - Developer B: US6 (View members) - can work in parallel with US3
5. Developer A completes US4 (Create content) - requires US3
6. Developer B completes US5 (Join events) - requires US4

---

## Critical Refactoring Notes

### Admin Route Structure - SINGLE Implementation

**OLD APPROACH (NOT USED)**: Separate routes for global vs group admin
- ❌ /admin/global/events/* (global events)
- ❌ /admin/[group_slug]/events/* (group events)
- ❌ Duplicated code in two places

**NEW APPROACH (IMPLEMENTED)**: Single route with conditional filtering
- ✅ /admin/[group_slug]/events/* 
  - When group_slug === "global" → Show ALL events (platform admin)
  - When group_slug === "paris" → Show ONLY Paris events (community representative)
- ✅ Same component, same queries, different filter
- ✅ No code duplication

### Key Implementation Details

1. **Layout Logic** (src/routes/admin/[group_slug]/layout.tsx):
```typescript
const groupSlug = params.group_slug;

if (groupSlug === "global") {
  // Check platform admin role
  if (user.role !== 'admin') redirect(302, '/');
} else {
  // Check group representative role
  const isRep = await isRepresentative(user.id, groupSlug);
  if (!isRep) redirect(302, '/');
  
  // Load group context
  const group = await groupsService.getBySlug(groupSlug);
  sharedMap.set('group', group);
}
```

2. **Query Filtering** (in loaders):
```typescript
const groupSlug = params.group_slug;

if (groupSlug === "global") {
  // Return ALL events
  events = await eventsService.getAll();
} else {
  // Return only group events
  const group = await groupsService.getBySlug(groupSlug);
  events = await eventsService.getByGroupId(group.id);
}
```

3. **Access Control** (in actions):
```typescript
const groupSlug = params.group_slug;

if (groupSlug === "global") {
  // Only platform admins can create global content
  if (user.role !== 'admin') return { success: false, error: "Unauthorized" };
} else {
  // Check representative permission for specific group
  const canManage = await canManageGroupContent(user.id, groupSlug);
  if (!canManage) return { success: false, error: "Unauthorized" };
}
```

### Routes to Refactor (Phase 6, Tasks T033-T044)

All these existing routes need to move to [group_slug] pattern:
- `/admin/events/*` → `/admin/[group_slug]/events/*`
- `/admin/users/*` → `/admin/[group_slug]/users/*`
- `/admin/posts/*` → `/admin/[group_slug]/posts/*`
- `/admin/pages/*` → `/admin/[group_slug]/pages/*` (only when slug === "global")

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- CRITICAL: Admin routes use ONE implementation with conditional filtering, NOT separate implementations
- Avoid: code duplication in admin routes, forgetting to filter soft-deleted content, missing group membership checks
