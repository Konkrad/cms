# Research: Community Groups Feature

**Feature**: 003-community-groups  
**Date**: 2025-12-30  
**Status**: Complete

This document consolidates research findings for implementing the community groups feature, resolving all technical unknowns and establishing best practices.

## 1. Soft Delete Implementation in Drizzle ORM

### Decision
Implement soft deletes using a `deletedAt` timestamp field (nullable) and `deletedBy` user reference in both `posts` and `events` tables.

### Rationale
- **Data Preservation**: Maintains user engagement records (event participation, post interactions) even when content is deleted
- **Audit Trail**: `deletedBy` field enables tracking who deleted content and when
- **Query Performance**: Can use indexed WHERE clauses to filter out deleted content
- **Drizzle Pattern**: Aligns with existing timestamp patterns in the codebase (createdAt, updatedAt)

### Implementation Pattern
```typescript
// In schema definition
deletedAt: text("deleted_at"),
deletedBy: text("deleted_by").references(() => users.id),

// In service layer queries
.where(and(
  eq(posts.groupId, groupId),
  isNull(posts.deletedAt) // Filter out soft-deleted content
))
```

### Alternatives Considered
- **Boolean `isDeleted` flag**: Rejected because timestamp provides more information (when deleted) without additional storage cost
- **Separate deleted_content table**: Rejected as overly complex for the requirement and breaks referential integrity for engagement records
- **Hard deletes with audit log**: Rejected because spec explicitly requires preserving engagement data

## 2. Role-Based Access Control Pattern

### Decision
Implement role-based access control using a combination of:
1. Existing `users.role` enum (user, moderator, admin) for platform-level permissions
2. New `group_representatives` junction table for group-level permissions
3. Utility functions in `src/utils/access-control.ts` for permission checks

### Rationale
- **Existing Pattern**: Leverages existing `users.role` field for platform admin checks
- **Granular Control**: Junction table allows users to be representatives for specific groups
- **Reusable Logic**: Utility functions prevent scattered permission checks across codebase
- **Constitution Compliance**: Follows service layer pattern with centralized business logic

### Implementation Pattern
```typescript
// Utility functions
export async function isGroupRepresentative(userId: string, groupId: string): Promise<boolean>
export async function canManageGroupContent(userId: string, groupId: string): Promise<boolean>
export async function canViewGroupOnlyContent(userId: string, groupId: string): Promise<boolean>

// Usage in route loaders
const canManage = await canManageGroupContent(session.userId, params.groupId);
if (!canManage) {
  throw redirect(302, '/groups/' + params.groupId);
}
```

### Alternatives Considered
- **Role field on memberships table**: Rejected because users should be members first, then promoted; this creates cleaner separation
- **Bitwise permission flags**: Rejected as premature optimization; simple boolean checks sufficient for current scope
- **Policy classes/decorators**: Rejected because Qwik's serialization model makes decorators problematic

## 3. Content Visibility Filtering

### Decision
Add `groupId` (nullable foreign key) and `visibility` enum field to both `posts` and `events` tables. Filter content in service layer based on user's group memberships.

### Rationale
- **Schema First**: Follows constitution principle II (Schema-Driven Database Design)
- **Query Efficiency**: Single WHERE clause can filter by visibility in database rather than application layer
- **Null Semantics**: `groupId` NULL means platform-wide content (no group association)
- **Type Safety**: Zod enum validation ensures visibility values are always valid

### Implementation Pattern
```typescript
// Schema
groupId: text("group_id").references(() => groups.id),
visibility: text("visibility", { enum: ["group-only", "global"] }).default("global"),

// Service layer filtering
async function getVisiblePosts(userId: string) {
  const userGroupIds = await getUserGroupIds(userId);
  
  return db.select().from(posts)
    .where(and(
      isNull(posts.deletedAt),
      or(
        eq(posts.visibility, "global"),
        and(
          eq(posts.visibility, "group-only"),
          inArray(posts.groupId, userGroupIds)
        )
      )
    ));
}
```

### Alternatives Considered
- **Separate tables for group content**: Rejected because posts and events have identical visibility requirements; DRY principle
- **Audience/ACL table**: Rejected as over-engineering for binary visibility requirement
- **Private/public boolean**: Rejected because "group-only" is more semantically clear than "private"

## 4. Group Membership Validation for Event Participation

### Decision
Extend existing `events.service.ts` to check group membership before allowing event joins. Reuse existing `participation-status` table for tracking participation.

### Rationale
- **Existing Infrastructure**: `participation-status` table already tracks event participation
- **Single Responsibility**: Event service handles both event creation and participation logic
- **Early Validation**: Check membership in service layer before creating participation record
- **Clear Error Messages**: Return validation errors that UI can display to guide users

### Implementation Pattern
```typescript
// In events.service.ts
async function joinEvent(userId: string, eventId: string) {
  const event = await getEvent(eventId);
  
  if (event.groupId) {
    const isMember = await groupMembershipsService.isMember(userId, event.groupId);
    if (!isMember) {
      return { 
        success: false, 
        error: "You must be a member of this group to join this event" 
      };
    }
  }
  
  // Proceed with creating participation record
  // ...
}
```

### Alternatives Considered
- **Database constraint**: Rejected because constraint can't conditionally check based on groupId presence
- **Application-level middleware**: Rejected because it separates validation from business logic
- **Pre-flight check in UI only**: Rejected because client-side validation is insufficient for security

## 5. Geographic Coordinate Validation

### Decision
Validate latitude/longitude ranges in Zod schema using `.refine()` method with custom validators.

### Rationale
- **Fail Fast**: Constitution principle VII - validate inputs early using Zod schemas
- **Type Safety**: Keeps validation with schema definition, not scattered across codebase
- **Standard Ranges**: Latitude [-90, 90], Longitude [-180, 180] are well-established standards
- **User Feedback**: Zod error messages provide clear feedback to admins creating groups

### Implementation Pattern
```typescript
// In groups.ts schema
export const insertGroupSchema = baseInsertSchema.extend({
  latitude: z.string()
    .refine(val => {
      const num = parseFloat(val);
      return !isNaN(num) && num >= -90 && num <= 90;
    }, { message: "Latitude must be between -90 and 90" }),
  
  longitude: z.string()
    .refine(val => {
      const num = parseFloat(val);
      return !isNaN(num) && num >= -180 && num <= 180;
    }, { message: "Longitude must be between -180 and 180" }),
});
```

### Alternatives Considered
- **Database check constraint**: Rejected because Drizzle doesn't have first-class CHECK constraint support in SQLite
- **Service layer validation**: Rejected because it violates constitution principle - validation should be in schema
- **PostGIS/geography types**: N/A for SQLite; would consider if migrating to PostgreSQL

## 6. Qwik City Route Structure for Multi-Level Access

### Decision
Use nested route structure with shared loaders to enforce access control:
- `/groups/[groupId]/` - Public group pages (any user)
- `/groups/[groupId]/admin/` - Representative area (requires representative role)
- `/admin/groups/` - Platform admin area (requires admin role)

### Rationale
- **File-Based Routing**: Leverages Qwik City's convention for intuitive URL structure
- **Layout Composition**: Can use `layout.tsx` at each level to enforce access control
- **Loader Inheritance**: Child routes inherit parent loaders for shared data
- **Clear Separation**: URL structure makes permissions model obvious to developers and users

### Implementation Pattern
```typescript
// /groups/[groupId]/layout.tsx - loads group data for all child routes
export const useGroup = routeLoader$(async ({ params }) => {
  return await groupsService.getGroup(params.groupId);
});

// /groups/[groupId]/admin/layout.tsx - enforces representative access
export const useRepresentativeCheck = routeLoader$(async ({ params, sharedMap }) => {
  const session = sharedMap.get('session');
  const canManage = await canManageGroupContent(session.userId, params.groupId);
  if (!canManage) throw redirect(302, `/groups/${params.groupId}`);
});
```

### Alternatives Considered
- **Single route with conditional rendering**: Rejected because access control should be enforced at routing layer, not UI layer
- **API routes for all actions**: Rejected because Qwik City's route actions provide better type safety and less boilerplate
- **Middleware functions**: Rejected because Qwik's approach favors explicit loaders over implicit middleware chains

## Summary of Research Outcomes

All technical unknowns have been resolved with decisions that:

1. ✅ Align with constitution principles (schema-driven, service layer, fail fast)
2. ✅ Leverage existing patterns in the codebase (timestamps, relations, route actions)
3. ✅ Use appropriate Qwik and Drizzle features (loaders, actions, relations)
4. ✅ Maintain type safety through Zod schema generation
5. ✅ Support all functional requirements from the specification

No additional research or clarification needed. Ready to proceed to Phase 1 (Design & Contracts).
