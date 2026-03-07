# Groups Architecture

## Data Model

`groups` table: `id`, `name`, `slug`, `latitude`, `longitude`, `createdAt`, `updatedAt`
No description, no image — just a geo-located named entity.

### Supporting Tables
| Table | Purpose |
|---|---|
| `group_memberships` | Users who joined a group. Unique `(userId, groupId)`. Has `joinedAt`. |
| `group_representatives` | Members promoted to reps. Unique `(userId, groupId)`. Tracks `promotedBy`, `promotedAt`. |

## Role Hierarchy
1. **Anyone** — browse and join groups
2. **Member** (`group_memberships`) — can view `group-only` content
3. **Representative** (`group_representatives`) — gets own admin dashboard at `/admin/[group-slug]/`
4. **Platform Admin** (`users.role = 'admin'`) — manages all groups at `/admin/global/`

Access control: `cms/src/utils/access-control.ts`
- `canManageGroupContent` → checks `isRepresentative`
- `canViewGroupOnlyContent` → checks `isMember`
- `isPlatformAdmin` → checks `user.role === 'admin'`

## Content Scoped to Groups

Both **posts** and **events** have:
- `groupId` — nullable FK to groups
- `visibility` — `"global"` (everyone) or `"group-only"` (members only)

Events also carry the full ticketing stack: `inventoryGroups`, `products`, `tickets`, `transactions`, `participationStatus`, `eventPhotos`.

## Services
- `cms/src/services/groups.service.ts` — `getAll`, `getById`, `getBySlug`, `create`, `update` (no delete)
- `cms/src/services/group-memberships.service.ts` — `isMember`, `join`, `getUserGroups`, `getGroupMembers`, `getMembership`
- `cms/src/services/group-representatives.service.ts` — `isRepresentative`, `promote`, `getRepresentatives`

## Admin Routes (all under `/admin/[group_slug]/`)
- `/admin/global/groups` — list, create, edit all groups (platform admin only)
- `/admin/global/groups/[id]/members` — view members, promote to representative
- `/admin/[group-slug]/events` — create/manage events (filtered by group, or all if `global`)
- `/admin/[group-slug]/posts` — create/manage posts
- `/admin/[group-slug]/users` — user management
- `/admin/[group-slug]/pages` — page management

Layout auth in `cms/src/routes/admin/[group_slug]/layout.tsx` — redirects non-admins/non-reps.

## Public Routes
- `/groups` — browse all groups
- `/groups/[slug]` — group detail + Join button
- `/profile/groups` — logged-in user's memberships

## Known Gaps
- Public group detail page is thin — no posts, events, or member count shown
- No way to leave a group (only join)
- No way to demote a representative
- No `delete` on `groupsService`
- Group detail page shows raw lat/lon instead of resolved location name

## Display Name Note
`users.displayName` does NOT exist as a DB column. It is computed as `\`${name} ${familyName}\`` in JS (see `cms/src/utils/users.ts` → `formatUser()`). Always select `users.name` + `users.familyName` from DB and compute in JS.
