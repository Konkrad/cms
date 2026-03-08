# Route Contract: GET /users/[userId]

**Type**: Qwik City Page Route (SSR)  
**File**: `src/routes/users/[userId]/index.tsx`  
**Auth**: Required — redirect to `/login` if not authenticated

---

## Route Parameter

| Param     | Format                                              | Example                                              |
|-----------|-----------------------------------------------------|------------------------------------------------------|
| `userId`  | `<fullUUID>-<name-slug>` (URL segment)              | `a1b2c3d4-e5f6-7890-abcd-ef1234567890-john-doe`      |

The route extracts `uuid = params.userId.substring(0, 36)` and looks up the user via exact primary-key match.

---

## routeLoader$: `usePublicProfile`

### Input
- `params.userId` — the full URL slug (shortId + name)

### Processing
1. Call `requireAuth(event)` — redirect to `/login` if unauthenticated
2. Extract `uuid = params.userId.substring(0, 36)`
3. `user = await usersService.getById(uuid)` — throw 404 if not found
4. `currentUser = await getCurrentUserData(event)`
5. `isOwner = currentUser?.id === user.id`
6. Fetch in parallel:
   - `groups = await groupMembershipsService.getUserGroups(user.id)`
   - `{ past, upcoming } = await participationService.getByUserId(user.id)`
   - email resolved from logins table (same as owner profile page)
7. Build `profilePictureUrl` from S3 key (same pattern as `/profile`)
8. If `!isOwner`: delete `user.email` and `user.yearOfBirth` from the object before returning — they must not appear in the serialized Qwik state sent to the client

### Returned Shape

```ts
{
  user: {
    id: string;
    name: string;
    familyName: string;
    displayName: string;
    city: string | null;
    country: string | null;
    profilePictureUrl: string | null;
    role: "user" | "moderator" | "admin";
    // Only in payload when isOwner === true — absent entirely otherwise:
    email?: string | null;
    yearOfBirth?: number | null;
  };
  isOwner: boolean;
  groups: Array<{ id: string; name: string; slug: string }>;
  pastEvents: Array<{
    id: string; title: string; startDate: string; endDate: string;
    city: string | null; country: string | null;
  }>;
  upcomingEvents: Array<{
    id: string; title: string; startDate: string; endDate: string;
    city: string | null; country: string | null;
  }>;
}
```

### Error Cases

| Condition | Response |
|-----------|----------|
| Not authenticated | `redirect(302, "/login")` |
| User not found for shortId | `status(404)` + return null |

---

## Page Component Sections

1. **Header**: Profile picture, display name, role, city/country
2. **Owner actions**: Link to `/profile/edit` (only when `isOwner`)
3. **Private info section** (only when `user.email !== undefined`): email, year of birth — these fields are absent from the payload for non-owners so presence-check is sufficient
4. **Communities list**: grid of group cards linking to `/groups/<slug>`
5. **Upcoming events list**: event cards for future participation
6. **Past events list**: event cards for attended events

---

## Canonical URL Generation

Used by all pages that produce `ParticipantData[]`:

```ts
// src/utils/users.ts
export function buildProfileUrl(user: { id: string; name: string; familyName: string }): string;
```

Called in:
- `src/routes/events/[id]/index.tsx` — when building `participants` array
- `src/routes/groups/[slug]/index.tsx` — when building `recentMembers` array and `repData.profileUrl`
