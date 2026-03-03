# Quickstart Guide: Community Groups Feature

**Feature**: 003-community-groups  
**Date**: 2025-12-30  
**Audience**: Developers implementing this feature

This guide provides a step-by-step walkthrough to implement the community groups feature following the constitution and established patterns.

---

## Prerequisites

- Qwik City application already set up
- Drizzle ORM configured with SQLite
- User authentication system in place
- Existing `users`, `posts`, `events`, and `participation_status` tables

---

## Phase 1: Database Schema (Estimated: 2 hours)

### Step 1: Create Group Schema

Create `src/db/schemas/groups.ts`:

```typescript
import { relations, sql } from "drizzle-orm";
import { sqliteTable, text } from "drizzle-orm/sqlite-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";
import crypto from "crypto";

export const groups = sqliteTable("groups", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  latitude: text("latitude").notNull(),
  longitude: text("longitude").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const groupsRelations = relations(groups, ({ many }) => ({
  memberships: many(groupMemberships),
  representatives: many(groupRepresentatives),
  posts: many(posts),
  events: many(events),
}));

// Import for relations (at bottom to avoid circular deps)
import { groupMemberships } from "./group-memberships";
import { groupRepresentatives } from "./group-representatives";
import { posts } from "./posts";
import { events } from "./events";

const baseInsertSchema = createInsertSchema(groups);
const baseSelectSchema = createSelectSchema(groups);

export const insertGroupSchema = baseInsertSchema
  .extend({
    id: z.string().uuid().default(() => crypto.randomUUID()),
    latitude: z.string().refine(
      (val) => {
        const num = parseFloat(val);
        return !isNaN(num) && num >= -90 && num <= 90;
      },
      { message: "Latitude must be between -90 and 90" }
    ),
    longitude: z.string().refine(
      (val) => {
        const num = parseFloat(val);
        return !isNaN(num) && num >= -180 && num <= 180;
      },
      { message: "Longitude must be between -180 and 180" }
    ),
    createdAt: z.string().default(() => new Date().toISOString()),
    updatedAt: z.string().default(() => new Date().toISOString()),
  })
  .partial({ id: true, createdAt: true, updatedAt: true });

export const updateGroupSchema = baseInsertSchema
  .omit({ id: true, createdAt: true })
  .partial()
  .extend({
    latitude: z.string().refine(
      (val) => {
        const num = parseFloat(val);
        return !isNaN(num) && num >= -90 && num <= 90;
      },
      { message: "Latitude must be between -90 and 90" }
    ).optional(),
    longitude: z.string().refine(
      (val) => {
        const num = parseFloat(val);
        return !isNaN(num) && num >= -180 && num <= 180;
      },
      { message: "Longitude must be between -180 and 180" }
    ).optional(),
    updatedAt: z.string().default(() => new Date().toISOString()).optional(),
  });

export const selectGroupSchema = baseSelectSchema;

export type Group = z.infer<typeof selectGroupSchema>;
export type InsertGroup = z.infer<typeof insertGroupSchema>;
export type UpdateGroup = z.infer<typeof updateGroupSchema>;
```

### Step 2: Create Group Memberships Schema

Create `src/db/schemas/group-memberships.ts`:

```typescript
import { relations, sql } from "drizzle-orm";
import { sqliteTable, text, unique } from "drizzle-orm/sqlite-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";
import { users } from "./users";
import { groups } from "./groups";
import crypto from "crypto";

export const groupMemberships = sqliteTable(
  "group_memberships",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull().references(() => users.id),
    groupId: text("group_id").notNull().references(() => groups.id),
    joinedAt: text("joined_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => ({
    uniqueMembership: unique().on(table.userId, table.groupId),
  })
);

export const groupMembershipsRelations = relations(groupMemberships, ({ one }) => ({
  user: one(users, {
    fields: [groupMemberships.userId],
    references: [users.id],
  }),
  group: one(groups, {
    fields: [groupMemberships.groupId],
    references: [groups.id],
  }),
}));

const baseInsertSchema = createInsertSchema(groupMemberships);
const baseSelectSchema = createSelectSchema(groupMemberships);

export const insertGroupMembershipSchema = baseInsertSchema
  .extend({
    id: z.string().uuid().default(() => crypto.randomUUID()),
    joinedAt: z.string().default(() => new Date().toISOString()),
  })
  .partial({ id: true, joinedAt: true });

export const selectGroupMembershipSchema = baseSelectSchema;

export type GroupMembership = z.infer<typeof selectGroupMembershipSchema>;
export type InsertGroupMembership = z.infer<typeof insertGroupMembershipSchema>;
```

### Step 3: Create Group Representatives Schema

Create `src/db/schemas/group-representatives.ts` (similar pattern with `promotedAt`, `promotedBy` fields).

### Step 4: Extend Posts and Events Schemas

Modify `src/db/schemas/posts.ts` to add:
- `groupId: text("group_id").references(() => groups.id)`
- `visibility: text("visibility", { enum: ["group-only", "global"] }).default("global")`
- `deletedAt: text("deleted_at")`
- `deletedBy: text("deleted_by").references(() => users.id)`

Add relations and update schemas accordingly.

Repeat for `src/db/schemas/events.ts`.

### Step 5: Update Schema Aggregator

Update `src/db/schema.ts`:
```typescript
export * from "./schemas/groups";
export * from "./schemas/group-memberships";
export * from "./schemas/group-representatives";
// ... existing exports
```

### Step 6: Generate and Apply Migration

```bash
npm run db:generate  # Generates migration SQL
npm run db:migrate   # Applies migration
npm run db:studio    # Verify schema in browser
```

---

## Phase 2: Service Layer (Estimated: 4 hours)

### Step 1: Create Groups Service

Create `src/services/groups.service.ts`:

```typescript
import { db } from "~/db/connection";
import { groups, insertGroupSchema, updateGroupSchema } from "~/db/schemas/groups";
import { eq } from "drizzle-orm";

export const groupsService = {
  async getAll() {
    return await db.select().from(groups).orderBy(groups.name);
  },

  async getById(id: string) {
    const results = await db.select().from(groups).where(eq(groups.id, id)).limit(1);
    return results[0] || null;
  },

  async create(data: unknown) {
    const validated = await insertGroupSchema.parseAsync(data);
    const [group] = await db.insert(groups).values(validated).returning();
    return group;
  },

  async update(id: string, data: unknown) {
    const validated = await updateGroupSchema.parseAsync(data);
    const [updated] = await db
      .update(groups)
      .set(validated)
      .where(eq(groups.id, id))
      .returning();
    return updated;
  },
};
```

### Step 2: Create Group Memberships Service

Create `src/services/group-memberships.service.ts` with methods:
- `isMember(userId: string, groupId: string): Promise<boolean>`
- `join(userId: string, groupId: string): Promise<GroupMembership>`
- `getUserGroups(userId: string): Promise<Group[]>`
- `getGroupMembers(groupId: string): Promise<User[]>`

### Step 3: Create Group Representatives Service

Create `src/services/group-representatives.service.ts` with methods:
- `isRepresentative(userId: string, groupId: string): Promise<boolean>`
- `promote(userId: string, groupId: string, promotedBy: string): Promise<GroupRepresentative>`
- `getRepresentatives(groupId: string): Promise<User[]>`

### Step 4: Create Access Control Utilities

Create `src/utils/access-control.ts`:

```typescript
import { groupRepresentativesService } from "~/services/group-representatives.service";
import { groupMembershipsService } from "~/services/group-memberships.service";

export async function canManageGroupContent(userId: string, groupId: string): Promise<boolean> {
  return await groupRepresentativesService.isRepresentative(userId, groupId);
}

export async function canViewGroupOnlyContent(userId: string, groupId: string): Promise<boolean> {
  return await groupMembershipsService.isMember(userId, groupId);
}
```

### Step 5: Extend Posts Service

Modify `src/services/posts.service.ts`:
- Add `getVisiblePosts(userId: string | null)` that filters by visibility and group membership
- Add `deletePost(postId: string, deletedBy: string)` that sets soft delete fields
- Update existing methods to filter WHERE `deletedAt IS NULL`

### Step 6: Extend Events Service

Modify `src/services/events.service.ts`:
- Add `getVisibleEvents(userId: string | null)` with visibility filtering
- Update `joinEvent()` to check group membership when `event.groupId` is not null
- Add `deleteEvent(eventId: string, deletedBy: string)` for soft deletes

---

## Phase 3: Routes - Platform Admin (Estimated: 3 hours)

### Step 1: List Groups Page

Create `src/routes/admin/groups/index.tsx`:

```typescript
import { component$ } from "@builder.io/qwik";
import { routeLoader$ } from "@builder.io/qwik-city";
import { groupsService } from "~/services/groups.service";

export const useAdminGroups = routeLoader$(async ({ sharedMap, redirect }) => {
  const session = sharedMap.get("session");
  if (session.user.role !== "admin") {
    throw redirect(302, "/");
  }
  
  return await groupsService.getAll();
});

export default component$(() => {
  const groups = useAdminGroups();
  
  return (
    <div>
      <h1>Manage Groups</h1>
      <a href="/admin/groups/new">Create New Group</a>
      <ul>
        {groups.value.map((group) => (
          <li key={group.id}>
            {group.name} - <a href={`/admin/groups/${group.id}/edit`}>Edit</a>
          </li>
        ))}
      </ul>
    </div>
  );
});
```

### Step 2: Create Group Page

Create `src/routes/admin/groups/new/index.tsx` with `useCreateGroup` action and form.

### Step 3: Edit Group Page

Create `src/routes/admin/groups/[groupId]/edit/index.tsx` with `useUpdateGroup` action.

---

## Phase 4: Routes - Public Group Pages (Estimated: 3 hours)

### Step 1: Group Details Page

Create `src/routes/groups/[groupId]/index.tsx`:
- Loader: fetch group, check membership, filter visible content
- Action: `useJoinGroup` for join button
- Display: group info, posts, events (filtered by visibility)

### Step 2: Groups List Page

Create `src/routes/groups/index.tsx` to list all groups.

---

## Phase 5: Routes - Representative Area (Estimated: 4 hours)

### Step 1: Group Admin Layout

Create `src/routes/groups/[groupId]/admin/layout.tsx`:
- Loader: check representative access, redirect if not authorized

### Step 2: Members Management

Create `src/routes/groups/[groupId]/admin/members/index.tsx`:
- Loader: fetch group members
- Display member list

### Step 3: Posts Management

Create `src/routes/groups/[groupId]/admin/posts/index.tsx`:
- Loader: fetch all group posts (including deleted)
- Actions: create, delete posts

### Step 4: Events Management

Create `src/routes/groups/[groupId]/admin/events/index.tsx`:
- Similar to posts management

---

## Phase 6: Components (Estimated: 2 hours)

Create reusable components in `src/components/groups/`:
- `GroupCard.tsx` - Display group summary
- `GroupHeader.tsx` - Group name, location, join button
- `MemberList.tsx` - List of group members
- `GroupAdminNav.tsx` - Navigation for representative area

---

## Phase 7: Testing (Estimated: 3 hours)

### Functional Tests

1. **Group Creation**: Admin creates group → verify in database
2. **Join Group**: User joins → verify membership record
3. **Visibility**: Create group-only post → verify non-members can't see it
4. **Event Join**: Non-member tries to join group event → verify error
5. **Soft Delete**: Representative deletes post → verify hidden but data preserved
6. **Representative Promotion**: Admin promotes user → verify access to admin area

### Integration Tests

Test full workflows:
- Admin creates group → User joins → Representative creates content → Users view/join
- Representative creates group-only event → Member joins → Non-member blocked

---

## Phase 8: Migration Path (Estimated: 1 hour)

### Existing Data

- No migration needed for existing posts/events (new fields default to NULL and "global")
- Existing events continue to work (no group association means platform-wide)

### Deployment Checklist

- [ ] Run migrations on production database
- [ ] Verify indexes are created
- [ ] Test access control with real user accounts
- [ ] Verify soft delete filtering in all queries
- [ ] Monitor performance of visibility queries

---

## Common Pitfalls

1. **Forgetting to filter deleted content**: Always add `WHERE deletedAt IS NULL` in queries
2. **Not checking group membership for events**: Validate in service layer, not just UI
3. **Circular imports in schemas**: Keep relation imports at bottom of schema files
4. **Missing authorization checks**: Every representative action must verify permissions
5. **Visibility validation**: Ensure group-only posts have non-null groupId

---

## Performance Optimization

- Add indexes on `(groupId, deletedAt)` for posts and events
- Add indexes on `(userId)` and `(groupId)` for memberships
- Consider cursor pagination for large group member lists
- Cache user's group memberships in session if queried frequently

---

## Next Steps

After implementation:
1. Run through all user scenarios from spec
2. Verify success criteria measurements
3. Document any deviations from plan
4. Update constitution if new patterns emerged
5. Run through tasks.md checklist (generated by `/speckit.tasks`)

---

## Questions or Issues?

If you encounter issues during implementation:
1. Check that all schema relations are bidirectional
2. Verify Zod schemas are being used in route actions
3. Ensure service layer methods validate inputs before DB operations
4. Review constitution for alignment with patterns
