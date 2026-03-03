# Data Model: Community Groups Feature

**Feature**: 003-community-groups  
**Date**: 2025-12-30  
**Status**: Complete

This document defines the database schema, entities, relationships, and validation rules for the community groups feature.

## Entity Diagram

```
┌─────────────┐
│    users    │ (existing)
│─────────────│
│ id (PK)     │
│ name        │
│ role        │──┐
└─────────────┘  │
       │         │
       │ 1       │ 1
       │         │
       ↓ *      ↓ *
┌──────────────────────┐      ┌────────────────────────┐
│  group_memberships   │      │ group_representatives  │
│──────────────────────│      │────────────────────────│
│ id (PK)              │      │ id (PK)                │
│ user_id (FK)         │      │ user_id (FK)           │
│ group_id (FK)        │      │ group_id (FK)          │
│ joined_at            │      │ promoted_at            │
└──────────────────────┘      │ promoted_by (FK)       │
       │                       └────────────────────────┘
       │ *                            │ *
       │                              │
       │ 1                            │ 1
       ↓                              ↓
┌─────────────┐                ┌─────────────┐
│   groups    │◄───────────────│    posts    │ (modified)
│─────────────│       *        │─────────────│
│ id (PK)     │                │ id (PK)     │
│ name        │       1        │ title       │
│ latitude    │                │ body        │
│ longitude   │                │ user_id (FK)│
│ created_at  │◄───────────────│ group_id (FK) [nullable]
└─────────────┘       *        │ visibility  │
       │ 1                     │ deleted_at  │
       │                       │ deleted_by (FK)
       ↓ *                     └─────────────┘
┌─────────────┐
│   events    │ (modified)
│─────────────│
│ id (PK)     │
│ title       │
│ start_date  │
│ user_id (FK)│
│ group_id (FK) [nullable]
│ visibility  │
│ deleted_at  │
│ deleted_by (FK)
└─────────────┘
       │ 1
       │
       ↓ *
┌──────────────────────┐
│ participation_status │ (existing)
│──────────────────────│
│ user_id (FK)         │
│ event_id (FK)        │
│ status               │
└──────────────────────┘
```

## Entities

### 1. groups (NEW)

**Purpose**: Represents local community organizations with geographic location.

**Fields**:
- `id` (text, PK): UUID identifier
- `name` (text, NOT NULL): Display name of the group
- `latitude` (text, NOT NULL): Geographic latitude coordinate
- `longitude` (text, NOT NULL): Geographic longitude coordinate
- `created_at` (text, NOT NULL): Timestamp of group creation
- `updated_at` (text, NOT NULL): Timestamp of last update

**Relationships**:
- One-to-many with `group_memberships` (users belonging to group)
- One-to-many with `group_representatives` (representatives managing group)
- One-to-many with `posts` (content created for group)
- One-to-many with `events` (events organized by group)

**Validation Rules**:
- `name`: Required, non-empty string
- `latitude`: Must be valid number between -90 and 90
- `longitude`: Must be valid number between -180 and 180
- `id`: Auto-generated UUID if not provided

**State Transitions**: N/A (groups are created and updated but not deleted in initial scope)

---

### 2. group_memberships (NEW)

**Purpose**: Junction table linking users to groups they have joined.

**Fields**:
- `id` (text, PK): UUID identifier
- `user_id` (text, FK → users.id, NOT NULL): User who joined
- `group_id` (text, FK → groups.id, NOT NULL): Group joined
- `joined_at` (text, NOT NULL): Timestamp when user joined group

**Relationships**:
- Many-to-one with `users` (each membership belongs to one user)
- Many-to-one with `groups` (each membership belongs to one group)

**Validation Rules**:
- Composite uniqueness constraint on (user_id, group_id) to prevent duplicate joins
- Both foreign keys must reference existing records
- `joined_at`: Auto-set to current timestamp if not provided

**State Transitions**:
```
[No membership] → JOIN → [Active member]
```

---

### 3. group_representatives (NEW)

**Purpose**: Tracks which users have representative permissions for which groups.

**Fields**:
- `id` (text, PK): UUID identifier
- `user_id` (text, FK → users.id, NOT NULL): User who is representative
- `group_id` (text, FK → groups.id, NOT NULL): Group being managed
- `promoted_at` (text, NOT NULL): Timestamp when user was promoted
- `promoted_by` (text, FK → users.id, NOT NULL): Admin who granted the role

**Relationships**:
- Many-to-one with `users` (each role assignment belongs to one user)
- Many-to-one with `groups` (each role assignment belongs to one group)
- Many-to-one with `users` via `promoted_by` (audit trail)

**Validation Rules**:
- Composite uniqueness constraint on (user_id, group_id) to prevent duplicate role assignments
- `user_id` must already exist in `group_memberships` for the same `group_id`
- `promoted_by` must be a platform admin (users.role = 'admin')

**State Transitions**:
```
[Regular member] → PROMOTE → [Community representative]
```

---

### 4. posts (MODIFIED)

**Purpose**: Existing content entity, extended to support group-bound posts with visibility control and soft deletes.

**New Fields Added**:
- `group_id` (text, FK → groups.id, NULLABLE): Group this post belongs to (NULL = platform-wide)
- `visibility` (text, enum: "group-only" | "global", default "global"): Who can see this post
- `deleted_at` (text, NULLABLE): Timestamp when post was soft-deleted
- `deleted_by` (text, FK → users.id, NULLABLE): User who deleted the post

**Existing Fields** (unchanged):
- `id`, `title`, `body`, `editor_state`, `user_id`, `created_at`, `updated_at`

**Relationships** (new):
- Many-to-one with `groups` via `group_id` (optional)
- Many-to-one with `users` via `deleted_by` (optional, audit trail)

**Validation Rules** (new):
- If `visibility = "group-only"`, then `group_id` MUST NOT be NULL
- If `visibility = "global"`, `group_id` MAY be NULL (platform post) or NOT NULL (group post visible to all)
- `deleted_at` and `deleted_by` must both be set together or both be NULL

**State Transitions** (new):
```
[Created] → DELETE → [Soft deleted] (deleted_at set, deleted_by recorded)
```

**Query Filtering**:
- Always filter WHERE `deleted_at IS NULL` unless explicitly querying deleted content
- For non-members: WHERE `visibility = 'global' AND deleted_at IS NULL`
- For members: WHERE `(visibility = 'global' OR (visibility = 'group-only' AND group_id IN (user's groups))) AND deleted_at IS NULL`

---

### 5. events (MODIFIED)

**Purpose**: Existing time-based activity entity, extended to support group-bound events with visibility control and soft deletes.

**New Fields Added**:
- `group_id` (text, FK → groups.id, NULLABLE): Group this event belongs to (NULL = platform-wide)
- `visibility` (text, enum: "group-only" | "global", default "global"): Who can see this event
- `deleted_at` (text, NULLABLE): Timestamp when event was soft-deleted
- `deleted_by` (text, FK → users.id, NULLABLE): User who deleted the event

**Existing Fields** (unchanged):
- `id`, `title`, `body`, `start_date`, `end_date`, `location_type`, `address`, `city`, `country`, `longitude`, `latitude`, `online_url`, `user_id`, `created_at`, `updated_at`

**Relationships** (new):
- Many-to-one with `groups` via `group_id` (optional)
- Many-to-one with `users` via `deleted_by` (optional, audit trail)
- One-to-many with `participation_status` (existing, tracks who joined)

**Validation Rules** (new):
- Same visibility rules as posts (see above)
- When user attempts to join event: if `group_id IS NOT NULL`, user must be in `group_memberships` for that group
- `deleted_at` and `deleted_by` must both be set together or both be NULL

**State Transitions** (new):
```
[Created] → DELETE → [Soft deleted] (deleted_at set, deleted_by recorded)
[Created] → JOIN (user) → [User participates] (only if user is group member when group_id IS NOT NULL)
```

---

### 6. users (EXISTING - NO CHANGES)

**Purpose**: Platform users with roles.

**Relevant Fields**:
- `id` (text, PK): UUID identifier
- `role` (text, enum: "user" | "moderator" | "admin"): Platform-level role
- Other fields: name, family_name, login_id, etc.

**Note**: Platform admin role (`role = 'admin'`) is checked for platform-wide admin operations (creating groups, promoting representatives). Regular users with `role = 'user'` can become community representatives for specific groups.

---

### 7. participation_status (EXISTING - NO CHANGES)

**Purpose**: Tracks which users have joined which events.

**Relevant Fields**:
- `user_id` (FK → users.id)
- `event_id` (FK → events.id)
- `status` (enum)

**Note**: Existing table continues to work. New validation logic in service layer checks group membership before allowing participation records to be created.

---

## Database Migrations

### Required Schema Changes

1. **Create `groups` table**
2. **Create `group_memberships` table** with composite unique constraint
3. **Create `group_representatives` table** with composite unique constraint
4. **Alter `posts` table**: Add `group_id`, `visibility`, `deleted_at`, `deleted_by` columns
5. **Alter `events` table**: Add `group_id`, `visibility`, `deleted_at`, `deleted_by` columns

### Migration Strategy

Since the project uses Drizzle ORM with SQLite:

1. Define new schemas in `src/db/schemas/*.ts`
2. Update `src/db/schema.ts` to export new schemas
3. Run `drizzle-kit generate` to create migration SQL
4. Run `drizzle-kit migrate` to apply migrations
5. Verify schema changes with `drizzle-kit studio`

**Note**: Per constitution, we modify database directly or force update - no manual migration file creation needed.

---

## Indexes

### Performance-Critical Queries

1. **Find user's groups**: Query `group_memberships` WHERE `user_id = ?`
   - Index: `idx_memberships_user_id` on `group_memberships(user_id)`

2. **Find group members**: Query `group_memberships` WHERE `group_id = ?`
   - Index: `idx_memberships_group_id` on `group_memberships(group_id)`

3. **Check representative status**: Query `group_representatives` WHERE `user_id = ? AND group_id = ?`
   - Composite unique constraint serves as index

4. **Filter visible posts**: Query `posts` WHERE `visibility = 'global' AND deleted_at IS NULL`
   - Index: `idx_posts_visibility_deleted` on `posts(visibility, deleted_at)`

5. **Filter visible events**: Query `events` WHERE `visibility = 'global' AND deleted_at IS NULL`
   - Index: `idx_events_visibility_deleted` on `events(visibility, deleted_at)`

6. **Group content lookup**: Query `posts/events` WHERE `group_id = ? AND deleted_at IS NULL`
   - Index: `idx_posts_group_id_deleted` on `posts(group_id, deleted_at)`
   - Index: `idx_events_group_id_deleted` on `events(group_id, deleted_at)`

---

## Validation Summary

| Field | Validation Rule | Error Message |
|-------|----------------|---------------|
| groups.name | Required, non-empty | "Group name is required" |
| groups.latitude | Number between -90 and 90 | "Latitude must be between -90 and 90" |
| groups.longitude | Number between -180 and 180 | "Longitude must be between -180 and 180" |
| posts.visibility | Enum: "group-only" or "global" | "Visibility must be group-only or global" |
| posts.group_id | NOT NULL when visibility = "group-only" | "Group-only posts must belong to a group" |
| events.visibility | Enum: "group-only" or "global" | "Visibility must be group-only or global" |
| events.group_id | NOT NULL when visibility = "group-only" | "Group-only events must belong to a group" |
| group_memberships | Unique (user_id, group_id) | "User is already a member of this group" |
| group_representatives | Unique (user_id, group_id) | "User is already a representative for this group" |
| group_representatives | user_id must be in group_memberships | "User must be a group member before becoming a representative" |

---

## Data Integrity Constraints

1. **Referential Integrity**: All foreign keys enforce CASCADE behavior on delete (except where soft delete is used)
2. **Soft Delete Consistency**: When `deleted_at` is set, `deleted_by` must also be set
3. **Visibility Logic**: Group-only content requires `group_id` to be non-null
4. **Representative Membership**: Users must be group members before being promoted to representatives
5. **Event Participation**: Users must be group members to join group events (enforced in service layer)

---

## Testing Checklist

- [ ] Verify unique constraints on membership and representative tables prevent duplicates
- [ ] Verify soft-deleted content is excluded from all queries
- [ ] Verify group-only content is invisible to non-members
- [ ] Verify global content is visible to all users
- [ ] Verify coordinate validation rejects out-of-range values
- [ ] Verify event join fails for non-members when event has group_id
- [ ] Verify event join succeeds for members when event has group_id
- [ ] Verify event join succeeds for anyone when event has NULL group_id
- [ ] Verify representative can only manage content for their assigned groups
- [ ] Verify platform admin can create groups and promote representatives
