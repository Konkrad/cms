# Research: Profile Improvements

## 1. URL Slug Design

**Decision**: `/users/<fullUUID>-<name-slug>` where the full 36-char UUID is the lookup key and the name slug is decorative.

**Example**: `/users/a1b2c3d4-e5f6-7890-abcd-ef1234567890-john-doe`

**Rationale**:
- Full UUID enables exact-match lookup via `usersService.getById()` — no LIKE, no collision risk, no extra column
- Including the name slug makes the URL human-readable
- Parsing is trivial: a UUID is always 36 chars, so `params.userId.substring(0, 36)` gives the exact ID

**Alternatives rejected**:
- Short ID (first 10 chars) + LIKE lookup — collision not zero; LIKE is imprecise and was explicitly rejected
- Name slug only — not unique; cannot do direct lookup

---

## 2. User Module for Profile URL Utility

**Decision**: Add a single `buildProfileUrl(user)` helper to `src/utils/users.ts`. No `buildProfileShortId` — the full UUID is used directly.

**Rationale**: `users.ts` already contains `formatUser` and `formatUserName` — adding a URL helper to the same file is consistent with the constitution's co-location principle (VI).

**Alternative rejected**: Separate `profile-url.ts` utility — unnecessary fragmentation for one small function.

---

## 3. Lookup by UUID

**Decision**: Use existing `usersService.getById(id: string)`. Extract the UUID from the URL param via `params.userId.substring(0, 36)`. No new service method, no LIKE query.

**Rationale**: UUID is always 36 chars. Exact equality lookup is O(1) against the primary key index. `getById` already exists in `usersService`.

---

## 4. Event Participation Queries (per user)

**Decision**: Add `participationService.getByUserId(userId)` which returns past and upcoming events for that user.

**Rationale**:
- `participationStatus` has `userId`, `eventId`, `status`
- Events have `startDate` / `endDate` ISO strings — comparable with JS date strings
- One query joining `participationStatus` + `events` is sufficient; split into past/upcoming in JS after fetch (avoids two round-trips)

**Query**: Join `participationStatus` with `events` filtering:
```ts
eq(participationStatus.userId, userId)
// then filter in JS:
// past = status === "yes" && event.endDate < now
// upcoming = (status === "yes" || status === "maybe") && event.startDate >= now
```

**Alternative rejected**: Two separate DB queries (past / upcoming) — cleaner but two round-trips; not worth the complexity.

---

## 5. Access Control for Public Profiles

**Decision**: The `/users/[userId]` route calls `requireAuth` (same as `/profile`). If not logged in → redirect to `/login`.

**Rationale**: Per spec — profiles are only visible to logged-in users. No additional group/membership gate is needed; any logged-in user can view any other profile.

**Privacy enforcement**: The loader strips `email` and `yearOfBirth` from the returned payload when `!isOwner`, so they are never included in the serialized Qwik state that is sent to the client. The component conditionally renders the private section based on whether these fields are present (`user.email !== undefined`).

---

## 6. ParticipantData Interface – Adding profileUrl

**Decision**: Add `profileUrl?: string | null` to `ParticipantData` in `ParticipantsTile.tsx`.

**Rationale**: `ParticipantData` is already consumed by both `ParticipantsTile` and `ParticipantsModal`. Adding an optional field is backwards-compatible with all existing call sites.

**Component behaviour**:
- `ParticipantsModal`: wraps each `<li>` row in an `<a href={p.profileUrl}>` when `profileUrl` is set
- `ParticipantsTile`: avatar stacking tile — no links added (visual-only component, linking would disrupt the design)

**Update points**: All callers building `ParticipantData[]` arrays (event route, group route) must populate `profileUrl` using `buildProfileUrl`.

---

## 7. LocalRepTile profileUrl

**Decision**: Update the `profileUrl` passed to `LocalRepTile` in the group route from `/profile/${rep.userId}` to the correct `/users/<fullUUID>-<name-slug>` URL.

**Rationale**: The current code hard-codes `/profile/<userId>` which is the *own* profile route, not a public user route. This is a pre-existing bug fixed as part of this feature.

---

## 8. Group Display on Profile

**Decision**: Use existing `groupMembershipsService.getUserGroups(userId)` which already returns `{ id, name, slug }` per group.

**Rationale**: No new query needed. Linking to `/groups/<slug>` is consistent with the rest of the app.
