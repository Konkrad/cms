# Data Model: Profile Improvements

## No Schema Changes

This feature requires **no database schema migrations**. All data already exists in the current schema:

| Data Needed | Source Table | Existing? |
|---|---|---|
| User basic info | `users` | ✓ |
| Group memberships | `group_memberships` → `groups` | ✓ |
| Event participation (past/upcoming) | `participation_status` → `events` | ✓ |
| Profile picture URL | `users.profile_picture_small` | ✓ |

---

## Derived Data Structures

These are TypeScript types derived from existing schemas — no new DB entities.

### `PublicProfile`

Returned by the `/users/[userId]` route loader. `email` and `yearOfBirth` are only included when the viewer is the profile owner — they are omitted entirely from the serialized payload for other viewers.

```ts
type PublicProfile = {
  id: string;
  name: string;
  familyName: string;
  displayName: string;        // "name familyName"
  city: string | null;
  country: string | null;
  profilePictureUrl: string | null;
  role: "user" | "moderator" | "admin";
  // Only present in payload when isOwner === true:
  email?: string | null;
  yearOfBirth?: number | null;
};
```

### `ProfileGroup`

A group the profiled user is a member of.

```ts
type ProfileGroup = {
  id: string;
  name: string;
  slug: string;
};
```

### `ProfileEvent`

An event the profiled user is participating in (past or upcoming).

```ts
type ProfileEvent = {
  id: string;
  title: string;
  startDate: string;   // ISO string
  endDate: string;     // ISO string
  city: string | null;
  country: string | null;
};
```

### Updated `ParticipantData` (extension)

Adds an optional `profileUrl` field to the existing interface in `ParticipantsTile.tsx`.

```ts
interface ParticipantData {
  id: string;
  name: string;
  familyName: string;
  profilePictureSmall: string | null;
  groupLabel?: string | null;
  city?: string | null;
  country?: string | null;
  profileUrl?: string | null;   // NEW — link to /users/<shortId>-<slug>
}
```

---

## URL Helper Function (new, in `src/utils/users.ts`)

```ts
// Build the canonical profile URL for a user (full UUID + name slug)
export function buildProfileUrl(user: { id: string; name: string; familyName: string }): string {
  const slug = `${user.name} ${user.familyName}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return `/users/${user.id}-${slug}`;
}
```

No `buildProfileShortId` — the full UUID is used as-is.

---

## New Service Methods

### `participationService.getByUserId(userId: string)`

No change to `usersService` — the existing `getById(id)` is used directly.

Fetch all events the user participates in, split into past/upcoming.

```ts
async getByUserId(userId: string): Promise<{ past: ProfileEvent[]; upcoming: ProfileEvent[] }> {
  const now = new Date().toISOString();
  const rows = await db
    .select({
      status: participationStatus.status,
      eventId: events.id,
      title: events.title,
      startDate: events.startDate,
      endDate: events.endDate,
      city: events.city,
      country: events.country,
    })
    .from(participationStatus)
    .innerJoin(events, eq(participationStatus.eventId, events.id))
    .where(
      and(
        eq(participationStatus.userId, userId),
        isNull(events.deletedAt),
      ),
    );

  const past = rows
    .filter(r => r.status === "yes" && r.endDate < now)
    .map(toProfileEvent);

  const upcoming = rows
    .filter(r => (r.status === "yes" || r.status === "maybe") && r.startDate >= now)
    .map(toProfileEvent);

  return { past, upcoming };
}
```
