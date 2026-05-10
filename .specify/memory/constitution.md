<!--
Sync Impact Report
==================
Version Change: 1.0.0 → 1.1.0 (Minor — stack alignment + new principles)

Modified Principles:
  - III. Service Layer Pattern → amended: direct Drizzle queries allowed in
    route loaders for complex/one-off joins; services for reusable operations
  - V. Component Organization → amended: added qwikify$() / self-contained
    React component rule from AGENTS.md

Added Sections:
  - Principle VIII: Privacy at Serialization Boundaries (server-side data
    stripping before Qwik serialization)
  - Technology Stack: added Stripe, S3/AWS SDK, nodemailer + React Email,
    Telegram, Mapbox, BlockNote + qwikify$, bcryptjs, date-fns, sharp, QR code
  - Development Workflow: Auth Conventions subsection

Removed / Corrected:
  - Database Conventions: removed Turso as production target (not in use);
    corrected migration approach to drizzle-kit push (aligns with AGENTS.md)

Templates Status:
  ✅ .specify/templates/plan-template.md — constitution check table is generic,
     no specific principle names hardcoded; no update required
  ✅ .specify/templates/spec-template.md — no constitution references; no update
  ✅ .specify/templates/tasks-template.md — no constitution references; no update

Follow-up TODOs: None
-->

# Community Management System Constitution

## Core Principles

### I. Centralized Configuration

Environment variables and configuration MUST be centralized and validated at startup.

- All environment variables managed in `src/env.ts` with Zod validation
- Application fails fast on misconfiguration with clear error messages
- No direct access to `process.env.*` outside of `src/env.ts`
- Import the validated `env` object for typed, guaranteed configuration access
- Add new environment variables to the schema first, then to `.env.example`

**Rationale**: Centralization prevents scattered configuration, Zod validation catches errors early,
typed access eliminates runtime surprises and makes debugging straightforward.

### II. Schema-Driven Database Design

Database schema and validation MUST follow a strict pattern using Drizzle ORM and Zod.

- Define tables in `src/db/schemas/[entity].ts` using Drizzle's table builders
- Export table, relations, insert schema, update schema, and select schema from each schema file
- Use `createInsertSchema` and `createSelectSchema` from `drizzle-zod` as base schemas
- Extend base schemas with `.extend()` for defaults, transformations, and computed fields
- Generate TypeScript types from Zod schemas using `z.infer<typeof schema>`
- Keep circular dependency imports at the bottom of schema files (after table definitions)
- Export types as: `User`, `InsertUser`, `UpdateUser` (select, insert, update patterns)

**Rationale**: Schema-first design ensures data integrity at all layers. Drizzle-zod integration
provides a single source of truth. Consistent patterns make code predictable and maintainable.

### III. Service Layer Pattern

Reusable data access and business logic MUST be encapsulated in service modules. Route loaders
may query the database directly for complex or one-off joins that are not reused elsewhere.

- Create service modules in `src/services/[entity].service.ts`
- Export a single object (e.g., `usersService`, `postsService`) with methods
- Services handle reusable database operations and validate input with Zod schemas
- Cursor-based pagination MUST use `pagination.ts` utilities (`decodeCursor`, `getNextCursorFromRows`)
- Keep services focused on a single entity/domain responsibility
- Route loaders MAY use `db.query.*` or `db.select()` directly for complex, route-specific joins
  that would not benefit from abstraction into a service method

**Rationale**: Services provide clean, reusable separation between routes and data access. However,
forcing every ad-hoc join through a service adds abstraction with no reuse benefit. Direct Drizzle
queries in loaders are acceptable when they are genuinely one-off.

### IV. Qwik Framework Conventions

Qwik and Qwik City patterns MUST be followed consistently across the application.

- Use `component$()` for all Qwik components with proper `$` suffix for lazy loading
- Use `routeLoader$()` for server-side data loading in route files
- Use `routeAction$()` with `zod$()` for form submissions and mutations
- Place route files in `src/routes/` following Qwik City directory structure (`[param]/index.tsx`)
- Use `useSignal()` for component-local reactive state
- Use `$()` optimizer for event handlers that need serialization
- Leverage Qwik's resumability — avoid unnecessary `useTask$()` when loaders suffice
- Follow file-based routing: `index.tsx` for pages, `layout.tsx` for nested layouts

**Rationale**: Qwik's optimizer requires specific patterns for optimal performance. Consistency in
these patterns ensures resumability, reduces bundle size, and maintains predictable behavior.

### V. Component Organization

UI components MUST follow a clear organizational structure.

- Place reusable components in `src/components/[category]/` (e.g., `ui/`, `builder/`, `editor/`)
- UI primitives (Button, Card, Input) belong in `src/components/ui/`
- Feature-specific components in named subdirectories under `src/components/`
- Components accept props via TypeScript interfaces; extend Qwik intrinsic elements when applicable
- Use `<Slot />` for component composition instead of children props
- Keep components focused and composable — avoid monolithic components
- React components embedded into Qwik via `qwikify$()` MUST be self-contained: all CSS co-located
  in the same directory as the component file (portable web-component principle)

**Rationale**: Clear organization improves discoverability. Self-contained React components prevent
style leakage and make them portable across contexts.

### VI. Type Safety Without Redundancy

Leverage existing type packages and generated types instead of manual type definitions.

- Install `@types/*` packages for third-party libraries (e.g., `@types/nodemailer`)
- Generate types from Zod schemas using `z.infer<typeof schema>` — never duplicate
- Use Drizzle's generated types for database entities
- When types must be created, co-locate with implementation (not a separate types directory)
- TypeScript should prevent errors, not create busywork

**Rationale**: Type generation eliminates drift between schemas and types. Using library types
prevents version mismatches. Type safety should be automatic, not a manual maintenance burden.

### VII. Fail Fast, Handle Gracefully

Error handling MUST distinguish between expected errors and exceptional failures.

- Do NOT wrap everything in try-catch blocks
- Only catch errors that are expected and can be handled gracefully
- Let unexpected errors bubble up to the caller/framework error boundary
- Validate inputs early using Zod schemas — fail before side effects occur
- Return structured error responses from route actions using `{ success, error }` patterns
- Log errors with sufficient context for debugging

**Rationale**: Indiscriminate try-catch blocks hide bugs and make debugging harder. Expected errors
(validation, not found) should be handled; unexpected errors should fail loud with full stack traces.

### VIII. Privacy at Serialization Boundaries

Sensitive data MUST be stripped server-side in route loaders before Qwik serializes the state
and sends it to the browser. Client-side conditional rendering is NOT sufficient for security.

- Identify sensitive fields (e.g., email, birth year, tokens) per route and viewer context
- Remove sensitive fields from the loader return value when the viewer is not the owner/privileged
- Conditional rendering based on `isOwner` or role flags may be used in addition, but never instead
- Never rely on "hidden" UI elements to protect server-sent data — if it's in the payload, it's exposed

**Rationale**: Qwik serializes the full loader state into the page HTML for resumability. Any field
included in the loader return value is visible in the page source, regardless of whether it is
rendered. Stripping at the loader level is the only safe enforcement point.

## Technology Stack Requirements

### Mandated Technologies

The following technologies form the core stack and MUST be used consistently:

- **Framework**: Qwik 1.7+ with Qwik City for routing and SSR
- **React interop**: `@qwik.dev/react` — used for third-party React components (BlockNote)
- **Database**: SQLite via `better-sqlite3` with Drizzle ORM 0.45+ for schema and queries
- **Validation**: Zod 4.2+ for all schemas (environment, forms, API inputs)
- **Styling**: Tailwind CSS 3.4+ with utility-first approach
- **Type Checking**: TypeScript 5.4+ in strict mode
- **Code Quality**: Biome 2.3+ for linting and formatting (replaces ESLint + Prettier)
- **Testing**: Playwright for end-to-end tests (`tests/`)

### Integrated Services & Libraries

| Concern | Library / Service | Config location |
|---------|-------------------|-----------------|
| Payments | Stripe (`stripe`) | `src/services/stripe.service.ts` |
| File storage | AWS S3 / MinIO (`@aws-sdk/*`) | `src/services/image-processing.service.ts` |
| Email (send) | Nodemailer (`nodemailer`) | `src/utils/send-email.ts` |
| Email (templates) | React Email (`@react-email/*`) | `src/emails/` |
| Notifications | Telegram bot (`node-telegram-bot-api`) | `src/services/telegram.service.ts` |
| Maps | Mapbox GL (`mapbox-gl`) | `src/components/page-blocks/FeatureBlock/LocationTile.tsx` |
| Rich text editor | BlockNote (`@blocknote/*`) via `qwikify$()` | `src/components/editor/` |
| Image processing | Sharp (`sharp`) | `src/services/image-processing.service.ts` |
| QR codes | `qrcode` + HMAC-SHA256 signing | `src/utils/qr-code.ts` |
| Password hashing | `bcryptjs` | auth flows |
| Date utilities | `date-fns` | throughout |

### Environment Variables

All variables defined and validated in `src/env.ts`. Required groups:

- **App**: `APP_URL`, `APP_NAME`, `NODE_ENV`
- **Security**: `MAGIC_LINK_SECRET`, `PHOTO_URL_SECRET`
- **SMTP**: `SMTP_HOST`, `SMTP_PORT`, `SMTP_FROM`, `SMTP_USER`, `SMTP_PASS`
- **S3/Storage**: `AWS_REGION`, `AWS_ENDPOINT` (MinIO only), `AWS_ACCESS_KEY_ID`,
  `AWS_SECRET_ACCESS_KEY`, `S3_BUCKET`, `S3_UPLOAD_PATH`
- **Stripe**: `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET`
- **Telegram**: `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHANNEL_ID`
- **Mapbox**: `PUBLIC_MAPBOX_ACCESS_TOKEN`

### Database Conventions

- Schema defined in `src/db/schemas/` with one file per entity
- Schema aggregator at `src/db/schema.ts` exports all schemas
- Connection module at `src/db/connection.ts` provides the single `db` export
- Schema changes are applied via `drizzle-kit push` (pushes schema directly to the DB)
- Do NOT write manual SQL migration files; do NOT commit generated migration files
- SQLite (`better-sqlite3`) is the database — there is no Turso/libSQL target at this time

### API Design Conventions

- Use Qwik City's `routeAction$()` for mutations, `routeLoader$()` for queries
- API routes in `src/routes/api/` only when external access is needed
- Validate inputs with `zod$()` middleware in route actions
- Return structured responses: `{ success: boolean, data?: any, error?: string }`

## Development Workflow

### Project Structure Standards

```
src/
├── components/        # UI components organized by category
│   ├── ui/           # Reusable UI primitives
│   ├── builder/      # Page builder components
│   ├── editor/       # Rich text editor (BlockNote via qwikify$)
│   └── page-blocks/  # Composable page section components
├── db/               # Database layer
│   ├── connection.ts # Database connection singleton
│   ├── schema.ts     # Schema aggregator (exports all schemas)
│   └── schemas/      # Individual entity schemas
├── emails/           # React Email templates + components
├── routes/           # Qwik City file-based routing
│   ├── admin/        # Admin interface routes
│   ├── api/          # External API endpoints (webhook handlers etc.)
│   └── [...]/        # Public routes
├── services/         # Reusable business logic and data access
├── utils/            # Shared utilities (auth, email sending, QR, etc.)
├── env.ts            # Environment configuration with Zod validation
└── root.tsx          # Application root component
```

### File Naming Conventions

- Components: PascalCase (e.g., `Button.tsx`, `UserCard.tsx`)
- Services: kebab-case with `.service.ts` suffix (e.g., `posts.service.ts`)
- Schemas: kebab-case (e.g., `users.ts`, `menu-items.ts`)
- Utilities: kebab-case (e.g., `server-auth.ts`, `send-email.ts`)
- Routes: kebab-case directories, `index.tsx` for pages, `layout.tsx` for layouts

### Auth Conventions

Authentication is magic-link + OTP email-based with DB-backed sessions.

- Auth entry point: `src/utils/server-auth.ts`
  - `requireAuth(event)` — redirects to `/login` if no valid session
  - `getCurrentUserData(event)` — returns full user record (resolves email from logins table)
  - `isAdmin(event)` — checks `user.role === "admin"`
- Session stored as HTTP-only cookie (`session` token → `sessions` table)
- Email is stored in the `logins` table, NOT in the `users` table; resolve via `loginId` join
- OTP: 6-letter alphanumeric code, 5 attempts max, single-use
- Magic link: base64-encoded token, single-use

### Breaking Changes Philosophy

**Break things. Do NOT maintain backwards compatibility unless explicitly required.**

- Refactor aggressively when patterns improve
- Update all call sites when changing function signatures
- Remove deprecated code immediately rather than marking it deprecated
- Trust TypeScript to catch breakage at compile time

**Rationale**: Early-stage projects benefit from aggressive iteration. Backwards compatibility
creates technical debt before stability is needed. TypeScript prevents most breakage from runtime.

### Documentation Philosophy

**Do NOT create documentation without being asked.**

- Code should be self-documenting through clear naming and structure
- When in doubt about documentation needs, ask the user
- Comments only for non-obvious complexity or "why", not "what"

**Rationale**: Over-documentation becomes stale and misleading. Documentation should be created
when requested, not preemptively.

## Governance

### Constitution Authority

This constitution supersedes all other development practices and preferences. When conflicts arise
between this document and external standards, this document wins.

### Amendment Process

Amendments to this constitution require:

1. Clear justification for the change (problem being solved)
2. Impact assessment on existing code and templates
3. Version bump following semantic versioning (MAJOR.MINOR.PATCH)
4. Update of dependent templates and documentation

### Compliance Requirements

- All work MUST comply with principles outlined herein
- Constitution violations must be explicitly justified with "why needed" and "why alternatives rejected"
- Templates in `.specify/templates/` should reference relevant principles
- Complexity that contradicts simplicity principles requires documented justification

### Versioning Policy

- MAJOR: backward-incompatible governance change, principle removal or redefinition
- MINOR: new principle or section added, or materially expanded guidance
- PATCH: clarifications, wording, typo fixes, non-semantic refinements

Constitution changes MUST update the version line, last-amended date, and the Sync Impact Report.

**Version**: 1.1.0 | **Ratified**: 2025-12-25 | **Last Amended**: 2026-03-08
