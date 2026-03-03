# Implementation Plan: Community Groups

**Branch**: `003-community-groups` | **Date**: 2025-12-30 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/003-community-groups/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

Implement a community groups feature that allows platform admins to create and manage local community organizations, promote community representatives with elevated permissions for their groups, and enable representatives to create group-scoped or global content. The feature introduces a dual admin area: global platform administration and group-specific administration with distinct URL patterns and access control.

## Technical Context

**Language/Version**: TypeScript 5.4+ with Qwik 1.7+  
**Primary Dependencies**: Qwik City (routing), Drizzle ORM 0.45+, Zod 4.2+, Tailwind CSS 3.4+  
**Storage**: SQLite (development) via Drizzle ORM with schema-driven design  
**Testing**: Vitest (existing test framework)  
**Target Platform**: Web application (SSR with Qwik)
**Project Type**: Web application (frontend + backend integrated in Qwik City)  
**Performance Goals**: Admin area page loads <200ms, group join action <3s response time  
**Constraints**: Role-based access control must enforce group scoping with zero unauthorized access  
**Scale/Scope**: Support multiple groups (10-100 initially), 1000s of users per group, group-specific content isolation

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### ✅ Compliance Assessment

**Principle I - Centralized Configuration**: ✅ Compliant
- Group management features will use existing `env.ts` pattern
- No new configuration required; uses existing database and auth

**Principle II - Schema-Driven Database Design**: ✅ Compliant
- New entities (Group, Membership, GroupRole) will follow Drizzle + Zod pattern
- Schemas in `src/db/schemas/groups.ts`, `src/db/schemas/memberships.ts`
- Follow existing patterns for insert/update/select schemas

**Principle III - Service Layer Pattern**: ✅ Compliant
- Create `src/services/groups.service.ts` for group operations
- Create `src/services/memberships.service.ts` for membership operations
- Reuse existing `posts.service.ts` and `events.service.ts` with group scoping

**Principle IV - Qwik Framework Conventions**: ✅ Compliant
- Route structure will follow Qwik City file-based routing
- Use `routeLoader$()` for data fetching, `routeAction$()` with `zod$()` for mutations
- Leverage existing component patterns

**Principle V - Component Organization**: ✅ Compliant
- Group admin UI components in `src/components/admin/` following existing patterns
- Reuse existing UI primitives from `src/components/ui/`

**Principle VI - Type Safety**: ✅ Compliant
- Generate types from Zod schemas using `z.infer<typeof schema>`
- No manual type definitions

**Principle VII - Error Handling**: ✅ Compliant
- Validate group membership before event joins (expected errors)
- Validate role permissions at route level (expected errors)
- Let unexpected errors bubble up

**Breaking Changes Philosophy**: ✅ Compliant
- Will reorganize admin routes from `/admin/*` to `/admin/global/*` and `/admin/{group_slug}/*`
- This is a breaking change but acceptable per constitution principle
- TypeScript will catch all route reference updates needed

### Gate Status: ✅ PASS

No violations detected. All new features align with constitutional principles.

## Project Structure

### Documentation (this feature)

```text
specs/003-community-groups/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
src/
├── components/
│   ├── ui/              # Existing UI primitives (Button, Card, Input)
│   ├── admin/           # Admin-specific components
│   │   ├── global/      # Platform admin components (group management)
│   │   └── group/       # Group-specific admin components
│   └── groups/          # Public group-related components
│
├── db/
│   ├── connection.ts    # Database connection singleton
│   ├── schema.ts        # Schema aggregator
│   └── schemas/
│       ├── groups.ts           # NEW: Group entity schema
│       ├── memberships.ts      # NEW: User-Group relationship
│       ├── posts.ts            # UPDATED: Add group_id, visibility
│       └── events.ts           # UPDATED: Add group_id, visibility
│
├── routes/
│   ├── admin/
│   │   ├── global/             # NEW: Platform admin routes
│   │   │   ├── groups/
│   │   │   │   ├── index.tsx           # List all groups
│   │   │   │   ├── new/index.tsx       # Create group
│   │   │   │   └── [id]/
│   │   │   │       ├── edit/index.tsx  # Edit group
│   │   │   │       └── members/index.tsx # Manage members & promote representatives
│   │   │   ├── events/
│   │   │   │   └── [id]/
│   │   │   │       └── index.tsx       # Global event management (existing, moved)
│   │   │   ├── users/
│   │   │   │   └── index.tsx           # Global user management (existing, moved)
│   │   │   └── pages/
│   │   │       └── index.tsx           # SITE ADMIN ONLY: Page management
│   │   │
│   │   ├── [group_slug]/       # NEW: Group-specific admin routes
│   │   │   ├── layout.tsx              # Group admin layout with group context
│   │   │   ├── index.tsx               # Group dashboard
│   │   │   ├── events/
│   │   │   │   ├── index.tsx           # List group events
│   │   │   │   ├── new/index.tsx       # Create group event
│   │   │   │   └── [id]/
│   │   │   │       ├── edit/index.tsx          # Edit event
│   │   │   │       ├── details/index.tsx       # Event details
│   │   │   │       ├── attendance/index.tsx    # Attendance tracking
│   │   │   │       ├── tickets/index.tsx       # Ticket management
│   │   │   │       ├── participation/index.tsx # Participation
│   │   │   │       └── photos/index.tsx        # Event photos
│   │   │   ├── posts/
│   │   │   │   ├── index.tsx           # List group posts
│   │   │   │   ├── new/index.tsx       # Create group post
│   │   │   │   └── [id]/edit/index.tsx # Edit post
│   │   │   └── users/
│   │   │       └── index.tsx           # Group members list
│   │   │
│   │   └── layout.tsx          # UPDATED: Root admin layout with role detection
│   │
│   └── groups/                 # NEW: Public group pages
│       ├── index.tsx                   # Browse/search groups
│       └── [slug]/
│           ├── index.tsx               # Group detail page
│           ├── posts/index.tsx         # Group posts feed
│           └── events/index.tsx        # Group events list
│
├── services/
│   ├── groups.service.ts       # NEW: Group CRUD operations
│   ├── memberships.service.ts  # NEW: Join/leave, role management
│   ├── posts.service.ts        # UPDATED: Add group filtering
│   └── events.service.ts       # UPDATED: Add group filtering
│
└── utils/
    ├── access-control.ts       # NEW: Role checking utilities
    └── group-slug.ts           # NEW: Slug generation/validation
```

**Structure Decision**: Web application structure following Qwik City conventions. Admin routes split into two distinct areas: `/admin/global/*` for platform administrators and `/admin/{group_slug}/*` for community representatives. This separation ensures clear access control boundaries and intuitive navigation. Middleware in layouts enforces role-based access at the route level.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

No violations detected. This section intentionally left empty.

## Admin URL Structure & Access Control

### Route Patterns

**Global Admin Routes** (`/admin/global/*`)
- **Purpose**: Platform-wide administration for site administrators
- **Access**: Platform administrators only (site admins)
- **Routes**:
  - `/admin/global/groups` - Manage all community groups
  - `/admin/global/groups/new` - Create new group
  - `/admin/global/groups/[id]/edit` - Edit group details
  - `/admin/global/groups/[id]/members` - Manage members & promote representatives
  - `/admin/global/events/[id]` - Global event administration (moved from `/admin/events/[id]`)
  - `/admin/global/users` - User management (moved from `/admin/users`)
  - `/admin/global/pages` - **SITE ADMINS ONLY**: Page management (moved from `/admin/pages`)

**Group-Specific Admin Routes** (`/admin/{group_slug}/*`)
- **Purpose**: Group-scoped administration for community representatives
- **Access**: Community representatives for the specific group
- **Slug Format**: Group name in lowercase with underscores for spaces (e.g., `paris`, `new_york`)
- **Routes**:
  - `/admin/paris/` - Paris group dashboard
  - `/admin/paris/events` - List Paris group events
  - `/admin/paris/events/new` - Create event for Paris group
  - `/admin/paris/events/[id]/edit` - Edit Paris group event
  - `/admin/paris/events/[id]/details` - Event details
  - `/admin/paris/events/[id]/attendance` - Attendance tracking
  - `/admin/paris/events/[id]/tickets` - Ticket management
  - `/admin/paris/posts` - List Paris group posts
  - `/admin/paris/posts/new` - Create post for Paris group
  - `/admin/paris/users` - View Paris group members

### Middleware & Access Control Guards

**Implementation Files**:
- `src/routes/admin/layout.tsx` - Root admin layout with role detection
- `src/routes/admin/global/layout.tsx` - Platform admin guard
- `src/routes/admin/[group_slug]/layout.tsx` - Group representative guard
- `src/utils/access-control.ts` - Role checking utilities

**Access Control Logic**:

```typescript
// src/utils/access-control.ts
export const checkPlatformAdmin = (user: User): boolean => {
  // Check if user has platform admin role
  return user.role === 'admin' || user.role === 'site_admin';
};

export const checkGroupRepresentative = async (
  userId: string, 
  groupSlug: string
): Promise<boolean> => {
  // Check if user is a representative for the specific group
  const membership = await membershipsService.getMembership(userId, groupSlug);
  return membership?.role === 'representative';
};

export const checkSiteAdmin = (user: User): boolean => {
  // Only site admins can manage pages and groups
  return user.role === 'site_admin';
};
```

**Layout Guards**:

1. **Global Admin Layout** (`/admin/global/layout.tsx`)
   ```typescript
   export const onRequest: RequestHandler = async ({ sharedMap, redirect }) => {
     const user = sharedMap.get('user');
     if (!checkPlatformAdmin(user)) {
       throw redirect(302, '/');
     }
   };
   ```

2. **Group Admin Layout** (`/admin/[group_slug]/layout.tsx`)
   ```typescript
   export const onRequest: RequestHandler = async ({ 
     params, 
     sharedMap, 
     redirect 
   }) => {
     const user = sharedMap.get('user');
     const groupSlug = params.group_slug;
     
     const isRepresentative = await checkGroupRepresentative(
       user.id, 
       groupSlug
     );
     
     if (!isRepresentative) {
       throw redirect(302, '/');
     }
     
     // Load group context for nested routes
     const group = await groupsService.getBySlug(groupSlug);
     sharedMap.set('group', group);
   };
   ```

3. **Pages Route Guard** (`/admin/global/pages/layout.tsx`)
   ```typescript
   export const onRequest: RequestHandler = async ({ sharedMap, redirect }) => {
     const user = sharedMap.get('user');
     if (!checkSiteAdmin(user)) {
       throw redirect(302, '/admin/global');
     }
   };
   ```

### Navigation & Breadcrumbs

**Admin Navigation Structure**:

```typescript
// src/components/admin/AdminNav.tsx
interface NavItem {
  label: string;
  href: string;
  icon?: string;
  requiresSiteAdmin?: boolean;
}

// Platform Admin Navigation
const globalAdminNav: NavItem[] = [
  { label: 'Groups', href: '/admin/global/groups', icon: 'users' },
  { label: 'Events', href: '/admin/global/events', icon: 'calendar' },
  { label: 'Users', href: '/admin/global/users', icon: 'user' },
  { 
    label: 'Pages', 
    href: '/admin/global/pages', 
    icon: 'file',
    requiresSiteAdmin: true 
  },
];

// Group Admin Navigation (dynamic based on group_slug)
const getGroupAdminNav = (groupSlug: string): NavItem[] => [
  { label: 'Dashboard', href: `/admin/${groupSlug}`, icon: 'home' },
  { label: 'Events', href: `/admin/${groupSlug}/events`, icon: 'calendar' },
  { label: 'Posts', href: `/admin/${groupSlug}/posts`, icon: 'file-text' },
  { label: 'Members', href: `/admin/${groupSlug}/users`, icon: 'users' },
];
```

**Breadcrumb Implementation**:

```typescript
// src/components/admin/Breadcrumbs.tsx
interface Breadcrumb {
  label: string;
  href?: string;
}

// Examples:
// Global: Admin > Groups > Edit "Paris"
// Group: Admin > Paris > Events > Edit "Summer Party"

export const generateBreadcrumbs = (
  pathname: string,
  context: { group?: Group; event?: Event; post?: Post }
): Breadcrumb[] => {
  const segments = pathname.split('/').filter(Boolean);
  const breadcrumbs: Breadcrumb[] = [{ label: 'Admin', href: '/admin' }];
  
  if (segments[1] === 'global') {
    breadcrumbs.push({ label: 'Global', href: '/admin/global' });
    // ... continue building global breadcrumbs
  } else {
    const groupSlug = segments[1];
    const group = context.group;
    breadcrumbs.push({ 
      label: group?.name || groupSlug, 
      href: `/admin/${groupSlug}` 
    });
    // ... continue building group breadcrumbs
  }
  
  return breadcrumbs;
};
```

### Slug Generation

**Group Slug Rules**:
- Convert group name to lowercase
- Replace spaces with underscores
- Remove special characters except underscores and hyphens
- Must be unique across all groups

```typescript
// src/utils/group-slug.ts
export const generateSlug = (name: string): string => {
  return name
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_-]/g, '')
    .replace(/_{2,}/g, '_')
    .replace(/^_|_$/g, '');
};

// Examples:
// "Paris" -> "paris"
// "New York" -> "new_york"
// "San Francisco Bay Area" -> "san_francisco_bay_area"
```

### Route Migration Plan

**Existing Routes to Move**:

1. `/admin/events/[id]/*` → `/admin/global/events/[id]/*` (for global events)
2. `/admin/users` → `/admin/global/users`
3. `/admin/pages` → `/admin/global/pages` (site admin only)
4. `/admin/posts` → `/admin/global/posts` (if exists)

**New Group Routes**:
- `/admin/[group_slug]/*` - All group-specific admin pages
- Group events will use group-scoped routes: `/admin/paris/events/[id]/*`

**Backward Compatibility**:
- None required per constitution breaking changes philosophy
- Update all internal links to use new route structure
- TypeScript will catch route reference updates needed
