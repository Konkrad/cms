<!--
Sync Impact Report
==================
Version Change: 0.0.0 → 1.0.0 (Initial Constitution)
Added Sections:
  - Core Principles (7 principles established)
  - Technology Stack Requirements
  - Development Workflow
  - Governance
Modified Principles: N/A (new constitution)
Removed Sections: N/A (new constitution)
Templates Status:
  ✅ .specify/templates/plan-template.md - reviewed, no updates required
  ✅ .specify/templates/spec-template.md - reviewed, no updates required
  ✅ .specify/templates/tasks-template.md - reviewed, no updates required
Follow-up TODOs: None
-->

# Community Management System Constitution

## Core Principles

### I. Centralized Configuration

Environment variables and configuration MUST be centralized and validated at startup.

- All environment variables managed in `src/env.ts` with Zod validation
- Application fails fast on misconfiguration with clear error messages
- No direct access to `process.env.*` outside of `src/env.ts`
- Import validated `env` object for typed, guaranteed configuration access
- Add new environment variables to the schema first, then to `.env.example`

**Rationale**: Centralization prevents scattered configuration, Zod validation catches errors early, typed access eliminates runtime surprises and makes debugging straightforward.

### II. Schema-Driven Database Design

Database schema and validation MUST follow a strict pattern using Drizzle ORM and Zod.

- Define tables in `src/db/schemas/[entity].ts` using Drizzle's table builders
- Export table, relations, insert schema, update schema, and select schema from each schema file
- Use `createInsertSchema` and `createSelectSchema` from `drizzle-zod` as base schemas
- Extend base schemas with `.extend()` for defaults, transformations, and computed fields
- Generate TypeScript types from Zod schemas using `z.infer<typeof schema>`
- Keep circular dependency imports at bottom of schema files (after table definitions)
- Export types as: `User`, `InsertUser`, `UpdateUser` (select, insert, update patterns)

**Rationale**: Schema-first design ensures data integrity at all layers. Drizzle-zod integration provides single source of truth. Consistent patterns make code predictable and maintainable.

### III. Service Layer Pattern

All data access and business logic MUST be encapsulated in service modules.

- Create service modules in `src/services/[entity].service.ts`
- Export a single object (e.g., `usersService`, `postsService`) with methods
- Services handle all database operations via Drizzle ORM
- Services validate input using Zod schemas before database operations
- Services return typed results based on schema types
- Cursor-based pagination MUST use the `pagination.ts` utilities (`decodeCursor`, `getNextCursorFromRows`)
- Keep services focused on single entity/domain responsibility

**Rationale**: Service layer provides clean separation between routes and data access, enables reuse across route handlers, maintains consistency in validation and error handling patterns.

### IV. Qwik Framework Conventions

Qwik and Qwik City patterns MUST be followed consistently across the application.

- Use `component$()` for all Qwik components with proper `$` suffix for lazy loading
- Use `routeLoader$()` for server-side data loading in route files
- Use `routeAction$()` with `zod$()` for form submissions and mutations
- Place route files in `src/routes/` following Qwik City directory structure (`[param]/index.tsx`)
- Use `useSignal()` for component-local reactive state
- Use `$()` optimizer for event handlers that need serialization
- Leverage Qwik's resumability - avoid unnecessary `useTask$()` when loaders suffice
- Follow file-based routing: `index.tsx` for pages, `layout.tsx` for nested layouts

**Rationale**: Qwik's optimizer requires specific patterns for optimal performance. Consistency in these patterns ensures resumability, reduces bundle size, and maintains predictable behavior.

### V. Component Organization

UI components MUST follow a clear organizational structure.

- Place reusable components in `src/components/[category]/` (e.g., `ui/`, `builder/`, `editor/`)
- UI primitives (Button, Card, Input) belong in `src/components/ui/`
- Feature-specific components (KoenigEditor, PageBuilder) in named subdirectories
- Components accept props via TypeScript interfaces extending Qwik's intrinsic elements when applicable
- Use `<Slot />` for component composition instead of children props
- Keep components focused and composable - avoid monolithic components

**Rationale**: Clear organization improves discoverability. Category-based structure scales with project growth. Component composition enables reuse without duplication.

### VI. Type Safety Without Redundancy

Leverage existing type packages and generated types instead of manual type definitions.

- Install `@types/*` packages for third-party libraries (e.g., `@types/nodemailer`)
- Generate types from Zod schemas using `z.infer<typeof schema>` - never duplicate
- Use Drizzle's generated types for database entities
- When types must be created, colocate with implementation (not separate types directory)
- TypeScript should prevent errors, not create busywork

**Rationale**: Type generation eliminates drift between schemas and types. Using library types prevents version mismatches. Type safety should be automatic, not manual maintenance burden.

### VII. Fail Fast, Handle Gracefully

Error handling MUST distinguish between expected errors and exceptional failures.

- Do NOT wrap everything in try-catch blocks
- Only catch errors that are expected and can be handled gracefully
- Let unexpected errors bubble up to the caller/framework error boundary
- Validate inputs early using Zod schemas - fail before side effects occur
- Return structured error responses from route actions using success/error patterns
- Log errors with sufficient context for debugging

**Rationale**: Indiscriminate try-catch blocks hide bugs and make debugging harder. Expected errors (validation, not found) should be handled; unexpected errors should fail loud and clear with full stack traces for rapid diagnosis.

## Technology Stack Requirements

### Mandated Technologies

The following technologies form the core stack and MUST be used consistently:

- **Framework**: Qwik 1.7+ with Qwik City for routing and SSR
- **Database**: SQLite (development) with Drizzle ORM 0.45+ for schema and queries
- **Validation**: Zod 4.2+ for all schemas (environment, forms, API inputs)
- **Styling**: Tailwind CSS 3.4+ with utility-first approach
- **Type Checking**: TypeScript 5.4+ in strict mode
- **Code Quality**: Biome 2.3+ for linting and formatting (replaces ESLint + Prettier)

### Database Conventions

- Schema defined in `src/db/schemas/` with one file per entity
- Schema aggregator at `src/db/schema.ts` exports all schemas
- Connection module at `src/db/connection.ts` provides single `db` export
- Migrations managed via `drizzle-kit generate` and `drizzle-kit migrate`
- Use SQLite for local development, production may use Turso (libSQL)

### API Design Conventions

- Use Qwik City's `routeAction$()` for mutations, `routeLoader$()` for queries
- API routes in `src/routes/api/` only when external API access needed
- Validate inputs with `zod$()` middleware in route actions
- Return structured responses: `{ success: boolean, data?: any, error?: string }`

## Development Workflow

### Project Structure Standards

```
src/
├── components/        # UI components organized by category
│   ├── ui/           # Reusable UI primitives
│   ├── builder/      # Page builder components
│   └── editor/       # Rich text editor components
├── db/               # Database layer
│   ├── connection.ts # Database connection singleton
│   ├── schema.ts     # Schema aggregator (exports all schemas)
│   └── schemas/      # Individual entity schemas
├── routes/           # Qwik City file-based routing
│   ├── admin/        # Admin interface routes
│   ├── api/          # External API endpoints (if needed)
│   └── [...]/        # Public routes
├── services/         # Business logic and data access services
├── utils/            # Shared utilities
├── emails/           # Email templates (React Email)
├── env.ts           # Environment configuration with validation
└── root.tsx         # Application root component
```

### File Naming Conventions

- Components: PascalCase (e.g., `Button.tsx`, `UserCard.tsx`)
- Services: kebab-case with `.service.ts` suffix (e.g., `posts.service.ts`)
- Schemas: kebab-case (e.g., `users.ts`, `menu-items.ts`)
- Utilities: kebab-case (e.g., `email-auth.ts`, `send-email.ts`)
- Routes: kebab-case directories, `index.tsx` for pages, `layout.tsx` for layouts

### Breaking Changes Philosophy

**Break things. Do NOT maintain backwards compatibility unless explicitly required.**

- Refactor aggressively when patterns improve
- Update all call sites when changing function signatures
- Remove deprecated code immediately rather than warning
- Trust TypeScript to catch breakage at compile time

**Rationale**: Early-stage projects benefit from aggressive iteration. Backwards compatibility creates technical debt before you have users depending on stability. TypeScript prevents most breakage from reaching runtime.

### Documentation Philosophy

**Do NOT create documentation without being asked.**

- Code should be self-documenting through clear naming and structure
- When in doubt about documentation needs, ask the user
- README.md exists for project overview and setup only
- API documentation only when building public APIs
- Comments only for non-obvious complexity or "why" not "what"

**Rationale**: Over-documentation becomes stale and misleading. Effort spent on premature documentation is better spent on clear code. Documentation should be created when users/teammates request it, not preemptively.

## Governance

### Constitution Authority

This constitution supersedes all other development practices and preferences. When conflicts arise between this document and external standards, this document wins.

### Amendment Process

Amendments to this constitution require:

1. Clear justification for the change (problem being solved)
2. Impact assessment on existing code and templates
3. Version bump following semantic versioning (MAJOR.MINOR.PATCH)
4. Update of dependent templates and documentation

### Compliance Requirements

- All pull requests MUST comply with principles outlined herein
- Constitution violations must be explicitly justified with "why needed" and "why alternatives rejected"
- Templates in `.specify/templates/` should reference relevant principles
- Complexity that contradicts simplicity principles requires documented justification

### Version Control

Constitution changes MUST update:
- Version number (semantic versioning)
- Last amended date (ISO 8601 format)
- Sync Impact Report (as HTML comment at top of file)

**Version**: 1.0.0 | **Ratified**: 2025-12-25 | **Last Amended**: 2025-12-25
