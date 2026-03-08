# Contract: ParticipantData Interface Extension

**File**: `src/components/page-blocks/FeatureBlock/ParticipantsTile.tsx`

---

## Updated Interface

```ts
export interface ParticipantData {
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

`profileUrl` is optional and nullable. Existing call sites that don't set it continue to work unchanged. When `null` or `undefined`, no link is rendered.

---

## Component Behaviour Changes

### ParticipantsTile
No change — it's a visual tile, not an interactive list. Profile links are intentionally not added here.

### ParticipantsModal (`src/components/events/ParticipantsModal.tsx`)
Each `<li>` is conditionally wrapped in an `<a>` tag:

```tsx
// When profileUrl is set:
<a href={p.profileUrl} class="...hover styles...">
  <li>...</li>   // avatar + name + subtitle
</a>

// When profileUrl is absent:
<li>...</li>   // unchanged
```

---

## Call Sites to Update

### Event route (`src/routes/events/[id]/index.tsx`)
When building `participantsUnsorted`, add:
```ts
profileUrl: buildProfileUrl({ id: u.id, name: u.name, familyName: u.familyName }),
```

### Group route (`src/routes/groups/[slug]/index.tsx`)
When building `recentMembers` (used in `ParticipantsTile`), add:
```ts
profileUrl: buildProfileUrl({ id: m.id, name: m.name, familyName: m.familyName }),
```

Also update the `repData.profileUrl` from `/profile/${rep.userId}` to:
```ts
profileUrl: buildProfileUrl({ id: rep.userId, name: rep.user.name, familyName: rep.user.familyName }),
```
