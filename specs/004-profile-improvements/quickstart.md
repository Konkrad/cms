# Quickstart: Profile Improvements

## Prerequisite: Understand the existing code

Before implementing, read these files:
- `src/utils/users.ts` — add `buildProfileUrl` here
- `src/services/participation.service.ts` — add `getByUserId` here
- `src/components/page-blocks/FeatureBlock/ParticipantsTile.tsx` — extend `ParticipantData`
- `src/components/events/ParticipantsModal.tsx` — add profile links
- `src/routes/events/[id]/index.tsx` — populate `profileUrl` in participants array
- `src/routes/groups/[slug]/index.tsx` — populate `profileUrl` in members + fix `repData.profileUrl`

`usersService.getById` already exists — no change needed to the users service.

---

## Step 1 – URL helper in `src/utils/users.ts`

Add one export after existing functions:

```ts
export function buildProfileUrl(user: { id: string; name: string; familyName: string }): string {
  const slug = `${user.name} ${user.familyName}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return `/users/${user.id}-${slug}`;
}
```

The full UUID is embedded in the URL so the route can look up the user with `getById` (exact primary-key match).

---

## Step 2 – `participationService.getByUserId` in `src/services/participation.service.ts`

```ts
import { events as eventsTable } from "~/db/schemas/events";
import { isNull } from "drizzle-orm";

async getByUserId(userId: string): Promise<{
  past: Array<{ id: string; title: string; startDate: string; endDate: string; city: string | null; country: string | null }>;
  upcoming: Array<{ id: string; title: string; startDate: string; endDate: string; city: string | null; country: string | null }>;
}> {
  const now = new Date().toISOString();
  const rows = await db
    .select({
      status: participationStatus.status,
      id: eventsTable.id,
      title: eventsTable.title,
      startDate: eventsTable.startDate,
      endDate: eventsTable.endDate,
      city: eventsTable.city,
      country: eventsTable.country,
    })
    .from(participationStatus)
    .innerJoin(eventsTable, eq(participationStatus.eventId, eventsTable.id))
    .where(
      and(
        eq(participationStatus.userId, userId),
        isNull(eventsTable.deletedAt),
      ),
    );

  const toEvent = (r: typeof rows[0]) => ({
    id: r.id, title: r.title, startDate: r.startDate,
    endDate: r.endDate, city: r.city, country: r.country,
  });

  return {
    past: rows.filter(r => r.status === "yes" && r.endDate < now).map(toEvent),
    upcoming: rows.filter(r => (r.status === "yes" || r.status === "maybe") && r.startDate >= now).map(toEvent),
  };
},
```

---

## Step 3 – Extend `ParticipantData` with `profileUrl`

In `src/components/page-blocks/FeatureBlock/ParticipantsTile.tsx`, add to the interface:

```ts
profileUrl?: string | null;
```

---

## Step 4 – Add links in `ParticipantsModal`

In `src/components/events/ParticipantsModal.tsx`, wrap the `<li>` with a conditional `<a>`:

```tsx
{p.profileUrl ? (
  <a href={p.profileUrl} class="block hover:bg-gray-50 rounded-xl transition-colors -mx-2 px-2">
    <li key={p.id} class="flex items-center gap-4 py-4 first:pt-0">
      {/* existing content */}
    </li>
  </a>
) : (
  <li key={p.id} class="flex items-center gap-4 py-4 first:pt-0">
    {/* existing content — no change */}
  </li>
)}
```

Note: Move the `key` prop to the outermost element in each branch.

---

## Step 5 – Populate `profileUrl` in event route

In `src/routes/events/[id]/index.tsx`, import `buildProfileUrl` and add to each participant:

```ts
import { formatUser, buildProfileUrl } from "~/utils/users";

// In participantsUnsorted.map:
profileUrl: buildProfileUrl({ id: u.id, name: u.name as string, familyName: u.familyName as string }),
```

---

## Step 6 – Populate `profileUrl` in group route

In `src/routes/groups/[slug]/index.tsx`:

1. Import `buildProfileUrl` from `~/utils/users`
2. In the `recentMembers` select, the data already has `id`, `name`, `familyName` — map it after query:

```ts
recentMembers: rawRecentMembers.map(m => ({
  ...m,
  profileUrl: buildProfileUrl(m),
  profilePictureSmall: null,   // already null from schema (no S3 URL resolution here)
})),
```

3. Fix `repData.profileUrl`:
```ts
profileUrl: buildProfileUrl({ id: rep.userId, name: rep.user.name, familyName: rep.user.familyName }),
```

---

## Step 7 – Create the public profile route

Create `src/routes/users/[userId]/index.tsx` modeled on the existing `src/routes/profile/index.tsx` but:

1. Accept any user ID (not just current user)
2. Extract UUID with `params.userId.substring(0, 36)` and look up via `usersService.getById(uuid)`
3. Compute `isOwner = currentUser?.id === user.id`
4. If `!isOwner`: remove `email` and `yearOfBirth` from the user object before returning — they must not be in the serialized Qwik state sent to the browser
5. In the component, render the private section only when `user.email !== undefined` (field absent → not owner)
6. Add sections: Communities, Upcoming Events, Past Events

See the route contract at `specs/004-profile-improvements/contracts/users-profile-route.md`.

---

## Testing Checklist

- [ ] Navigate to `/users/<uuid>-<name>` while logged out → redirected to `/login`
- [ ] Navigate to own profile URL → email and yearOfBirth visible
- [ ] Navigate to another user's profile URL → email and yearOfBirth absent from the HTML source and Qwik serialized state
- [ ] Group membership visible on profile
- [ ] Past attended events (status = "yes", event ended) visible
- [ ] Upcoming events (status = "yes"/"maybe", event not started) visible
- [ ] Event participant modal → clicking a participant navigates to their profile
- [ ] Group member list (members modal) → participants have profile links
- [ ] Invalid UUID → 404
