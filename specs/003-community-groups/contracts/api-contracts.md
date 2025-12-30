# API Contracts: Community Groups Feature

**Feature**: 003-community-groups  
**Date**: 2025-12-30  
**Type**: Qwik City Route Actions and Loaders

This document defines the API contracts for the community groups feature using Qwik City's `routeAction$` and `routeLoader$` patterns. These are not REST APIs but server actions and data loaders integrated with Qwik's SSR model.

---

## Route Actions (Mutations)

### 1. Create Group (Platform Admin)

**Route**: `/admin/groups/new/`  
**Action**: `useCreateGroup`  
**Method**: POST (via form submission)  
**Authorization**: Platform admin only (`users.role = 'admin'`)

**Request Schema** (Zod):
```typescript
{
  name: string,           // Required, min 1 char
  latitude: string,       // Required, -90 to 90
  longitude: string       // Required, -180 to 180
}
```

**Response**:
```typescript
{
  success: boolean,
  groupId?: string,       // UUID of created group
  error?: string          // Error message if failed
}
```

**Success Case**: Returns `{ success: true, groupId: "..." }` and redirects to `/admin/groups/[groupId]/edit`

**Error Cases**:
- Missing name: `"Group name is required"`
- Invalid latitude: `"Latitude must be between -90 and 90"`
- Invalid longitude: `"Longitude must be between -180 and 180"`
- Not authorized: `"Unauthorized"` (redirects to login)

---

### 2. Update Group (Platform Admin)

**Route**: `/admin/groups/[groupId]/edit/`  
**Action**: `useUpdateGroup`  
**Method**: POST (via form submission)  
**Authorization**: Platform admin only

**Request Schema**:
```typescript
{
  name?: string,          // Optional, min 1 char if provided
  latitude?: string,      // Optional, -90 to 90 if provided
  longitude?: string      // Optional, -180 to 180 if provided
}
```

**Response**:
```typescript
{
  success: boolean,
  error?: string
}
```

**Success Case**: Returns `{ success: true }` and reloads page data

**Error Cases**:
- Invalid coordinates: validation error message
- Group not found: `"Group not found"`
- Not authorized: `"Unauthorized"`

---

### 3. Join Group (User)

**Route**: `/groups/[groupId]/`  
**Action**: `useJoinGroup`  
**Method**: POST (via button click)  
**Authorization**: Authenticated user

**Request Schema**:
```typescript
{
  // No body - group ID from URL params
}
```

**Response**:
```typescript
{
  success: boolean,
  error?: string
}
```

**Success Case**: Returns `{ success: true }` and reloads page data

**Error Cases**:
- Already member: `"You are already a member of this group"`
- Group not found: `"Group not found"`
- Not authenticated: `"Please log in to join this group"`

---

### 4. Promote Member to Representative (Platform Admin)

**Route**: `/admin/groups/[groupId]/members/`  
**Action**: `usePromoteMember`  
**Method**: POST (via form submission)  
**Authorization**: Platform admin only

**Request Schema**:
```typescript
{
  userId: string          // UUID of user to promote
}
```

**Response**:
```typescript
{
  success: boolean,
  error?: string
}
```

**Success Case**: Returns `{ success: true }` and reloads member list

**Error Cases**:
- User not a member: `"User must be a member of the group first"`
- Already representative: `"User is already a representative for this group"`
- User not found: `"User not found"`
- Not authorized: `"Unauthorized"`

---

### 5. Create Group Post (Community Representative)

**Route**: `/groups/[groupId]/admin/posts/`  
**Action**: `useCreatePost`  
**Method**: POST (via form submission)  
**Authorization**: Community representative for this group

**Request Schema**:
```typescript
{
  title: string,          // Required
  editorState: string,    // BlockNote JSON
  visibility: "group-only" | "global"
}
```

**Response**:
```typescript
{
  success: boolean,
  postId?: string,
  error?: string
}
```

**Success Case**: Returns `{ success: true, postId: "..." }` and redirects to post view

**Error Cases**:
- Missing title: `"Title is required"`
- Invalid visibility: `"Visibility must be group-only or global"`
- Not authorized: `"You do not have permission to create posts for this group"`
- Group not found: `"Group not found"`

---

### 6. Create Group Event (Community Representative)

**Route**: `/groups/[groupId]/admin/events/`  
**Action**: `useCreateEvent`  
**Method**: POST (via form submission)  
**Authorization**: Community representative for this group

**Request Schema**:
```typescript
{
  title: string,
  body: string,
  startDate: string,      // ISO 8601 date
  endDate: string,        // ISO 8601 date
  locationType: string,
  address?: string,
  city?: string,
  country?: string,
  longitude?: string,
  latitude?: string,
  onlineUrl?: string,
  visibility: "group-only" | "global"
}
```

**Response**:
```typescript
{
  success: boolean,
  eventId?: string,
  error?: string
}
```

**Success Case**: Returns `{ success: true, eventId: "..." }` and redirects to event view

**Error Cases**:
- Validation errors: field-specific messages
- Not authorized: `"You do not have permission to create events for this group"`

---

### 7. Delete Post (Community Representative)

**Route**: `/groups/[groupId]/admin/posts/[postId]/`  
**Action**: `useDeletePost`  
**Method**: POST (via delete button)  
**Authorization**: Community representative who owns the group

**Request Schema**:
```typescript
{
  // No body - post ID from URL
}
```

**Response**:
```typescript
{
  success: boolean,
  error?: string
}
```

**Success Case**: Returns `{ success: true }` (soft delete: sets deleted_at and deleted_by)

**Error Cases**:
- Post not found: `"Post not found"`
- Not authorized: `"You do not have permission to delete this post"`
- Already deleted: `"Post has already been deleted"`

---

### 8. Delete Event (Community Representative)

**Route**: `/groups/[groupId]/admin/events/[eventId]/`  
**Action**: `useDeleteEvent`  
**Method**: POST (via delete button)  
**Authorization**: Community representative who owns the group

**Request Schema**:
```typescript
{
  // No body - event ID from URL
}
```

**Response**:
```typescript
{
  success: boolean,
  error?: string
}
```

**Success Case**: Returns `{ success: true }` (soft delete: sets deleted_at and deleted_by)

**Error Cases**:
- Event not found: `"Event not found"`
- Not authorized: `"You do not have permission to delete this event"`
- Already deleted: `"Event has already been deleted"`

---

### 9. Join Group Event (User)

**Route**: `/events/[eventId]/`  
**Action**: `useJoinEvent`  
**Method**: POST (via join button)  
**Authorization**: Authenticated user

**Request Schema**:
```typescript
{
  // No body - event ID from URL
}
```

**Response**:
```typescript
{
  success: boolean,
  error?: string
}
```

**Success Case**: Returns `{ success: true }` and updates participation status

**Error Cases**:
- Event not found: `"Event not found"`
- Not group member: `"You must be a member of this group to join this event"`
- Already joined: `"You have already joined this event"`
- Not authenticated: `"Please log in to join events"`

---

## Route Loaders (Queries)

### 1. List All Groups

**Route**: `/groups/`  
**Loader**: `useGroups`  
**Authorization**: Public

**Response**:
```typescript
{
  groups: Array<{
    id: string,
    name: string,
    latitude: string,
    longitude: string,
    memberCount: number,
    isUserMember: boolean    // Only if authenticated
  }>
}
```

---

### 2. Get Group Details

**Route**: `/groups/[groupId]/`  
**Loader**: `useGroup`  
**Authorization**: Public

**Response**:
```typescript
{
  group: {
    id: string,
    name: string,
    latitude: string,
    longitude: string,
    createdAt: string,
    memberCount: number
  },
  isUserMember: boolean,
  isUserRepresentative: boolean,
  visiblePosts: Array<Post>,      // Only group-only posts if user is member
  visibleEvents: Array<Event>      // Only group-only events if user is member
}
```

---

### 3. Get Group Members (Representative)

**Route**: `/groups/[groupId]/admin/members/`  
**Loader**: `useGroupMembers`  
**Authorization**: Community representative for this group

**Response**:
```typescript
{
  members: Array<{
    userId: string,
    name: string,
    displayName: string,
    joinedAt: string,
    isRepresentative: boolean
  }>
}
```

---

### 4. Get Group Posts (Representative)

**Route**: `/groups/[groupId]/admin/posts/`  
**Loader**: `useGroupPosts`  
**Authorization**: Community representative for this group

**Response**:
```typescript
{
  posts: Array<{
    id: string,
    title: string,
    visibility: "group-only" | "global",
    createdAt: string,
    deletedAt: string | null
  }>
}
```

---

### 5. Get Group Events (Representative)

**Route**: `/groups/[groupId]/admin/events/`  
**Loader**: `useGroupEvents`  
**Authorization**: Community representative for this group

**Response**:
```typescript
{
  events: Array<{
    id: string,
    title: string,
    startDate: string,
    visibility: "group-only" | "global",
    participantCount: number,
    deletedAt: string | null
  }>
}
```

---

### 6. List User's Groups (User Dashboard)

**Route**: `/profile/groups/`  
**Loader**: `useUserGroups`  
**Authorization**: Authenticated user

**Response**:
```typescript
{
  memberships: Array<{
    groupId: string,
    groupName: string,
    joinedAt: string,
    isRepresentative: boolean
  }>
}
```

---

### 7. Platform Admin - List All Groups

**Route**: `/admin/groups/`  
**Loader**: `useAdminGroups`  
**Authorization**: Platform admin only

**Response**:
```typescript
{
  groups: Array<{
    id: string,
    name: string,
    latitude: string,
    longitude: string,
    createdAt: string,
    memberCount: number,
    representativeCount: number
  }>
}
```

---

## Authorization Patterns

### Platform Admin Check
```typescript
const session = sharedMap.get('session');
if (session.user.role !== 'admin') {
  throw redirect(302, '/');
}
```

### Community Representative Check
```typescript
const canManage = await canManageGroupContent(session.userId, params.groupId);
if (!canManage) {
  throw redirect(302, `/groups/${params.groupId}`);
}
```

### Group Member Check
```typescript
const isMember = await groupMembershipsService.isMember(session.userId, params.groupId);
if (!isMember) {
  return { success: false, error: "You must be a member of this group" };
}
```

---

## Error Handling

All route actions follow the pattern:
```typescript
{
  success: boolean,
  data?: T,
  error?: string
}
```

Route loaders that fail authorization use `throw redirect(302, '/path')` to redirect.

Validation errors from Zod schemas are automatically caught by Qwik City and returned as form errors.

---

## Notes

- All mutations use Qwik City's `routeAction$` with `zod$()` validation
- All queries use Qwik City's `routeLoader$` for SSR data loading
- No traditional REST API endpoints needed
- CSRF protection is built into Qwik City's form handling
- All responses are typed using generated Zod types
