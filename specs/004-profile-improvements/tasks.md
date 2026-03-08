# Tasks: Profile Improvements (004-profile-improvements)

## Phase 1: Shared Infrastructure

- [ ] T001 Add `buildProfileUrl` to `src/utils/users.ts` — full UUID + name-slug: `/users/${user.id}-${slug}`
- [ ] T002 Add `participationService.getByUserId(userId)` to `src/services/participation.service.ts` — join `participation_status` with `events`, return `{ past, upcoming }` split by date vs now

**Checkpoint**: T001 and T002 must compile before any Phase 2–4 work.

---

## Phase 2: Participant Lists Link to Profiles (US1 — P1)

- [ ] T003 [P] Extend `ParticipantData` interface in `src/components/page-blocks/FeatureBlock/ParticipantsTile.tsx` — add `profileUrl?: string | null`
- [ ] T004 [P] Update `ParticipantsModal` in `src/components/events/ParticipantsModal.tsx` — wrap each `<li>` in `<a href={p.profileUrl}>` when set; hover style; move `key` to outermost element
- [ ] T005 [P] Populate `profileUrl` in `src/routes/events/[id]/index.tsx` — import `buildProfileUrl`; add to each participant entry
- [ ] T006 [P] Populate `profileUrl` in `src/routes/groups/[slug]/index.tsx` — import `buildProfileUrl`; map `recentMembers`; fix bug in `repData.profileUrl` (was `/profile/${rep.userId}`)

> T003 before T004. T001 before T005 + T006.

---

## Phase 3: Public Profile Route — Content (US2 + US4 — P1)

- [ ] T007 Create `src/routes/users/[userId]/index.tsx` loader (`usePublicProfile`):
  - `requireAuth` → redirect `/login`
  - Extract `uuid = params.userId.substring(0, 36)`; `usersService.getById(uuid)` → 404 if missing
  - `isOwner = currentUser?.id === user.id`
  - Resolve email from `logins` table via `user.loginId`
  - Parallel: `groupMembershipsService.getUserGroups(user.id)` + `participationService.getByUserId(user.id)`
  - Build `profilePictureUrl` from S3 key
  - Strip `email` and `yearOfBirth` from payload when `!isOwner`
- [ ] T008 Build page component in same file:
  - Header: picture/initials, name, role badge, city/country
  - Owner bar (when `isOwner`): link to `/profile/edit`, email, yearOfBirth fields
  - Communities section: group cards → `/groups/<slug>`; empty state
  - Upcoming Events section: title, date, location; empty state
  - Past Events section: title, date, location; empty state

> T007 before T008. T001 + T002 must be done before T007.

---

## Phase 4: Privacy Enforcement (US3 — P1)

- [ ] T009 Verify + harden T007 privacy stripping — confirm `email` and `yearOfBirth` keys are absent (not just null) in non-owner payload. Add comment: `// Principle VIII — privacy at serialization boundary`

---

## Phase 5: TypeScript Check

- [ ] T010 [P] `tsc --noEmit` — zero errors across all modified files; fix any type mismatches in `ParticipantData` call sites or loader return shapes

---

## Summary

| File | Task(s) | Change |
|------|---------|--------|
| `src/utils/users.ts` | T001 | Add `buildProfileUrl` |
| `src/services/participation.service.ts` | T002 | Add `getByUserId` |
| `src/components/page-blocks/FeatureBlock/ParticipantsTile.tsx` | T003 | Extend interface |
| `src/components/events/ParticipantsModal.tsx` | T004 | Add profile links |
| `src/routes/events/[id]/index.tsx` | T005 | Populate `profileUrl` |
| `src/routes/groups/[slug]/index.tsx` | T006 | Populate `profileUrl`, fix rep URL |
| `src/routes/users/[userId]/index.tsx` | T007, T008, T009 | **New file** |

## Dependency graph

```
T001 → T005, T006, T007
T002 → T007
T003 → T004
T007 → T008, T009
All → T010
```

Parallel first round: T001 + T002 + T003
Parallel second round: T004 + T005 + T006 + T007 (once T001+T002+T003 done)
