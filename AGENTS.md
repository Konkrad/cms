## Core Rules

1. Centralize configuration in `src/env.ts` with Zod validation.
2. Assume environment variables exist; set defaults in the central config object, not at call sites.
3. Do not access `process.env.*` outside `src/env.ts`.
4. Break things rather than preserving backward compatibility unless explicitly asked otherwise.
5. Do not create APIs unless they are explicitly needed. When in doubt, ask the user.
6. Do not create ad hoc types if a package already provides them; install the existing package types instead.
7. Do not wrap everything in `try/catch`. Catch only expected errors and let unexpected failures bubble up.
8. Do not create README or other documentation unless asked.
9. Do not create migration files; apply schema changes directly with `drizzle-kit push`.

## Qwik And Data Flow

- Use Qwik patterns consistently: `component$()`, `routeLoader$()`, `routeAction$()`, `useSignal()`, and `$()` where serialization requires it.
- Keep route-specific one-off joins in route loaders when abstraction would not be reused; use services for reusable operations.
- Strip sensitive data server-side in loaders before Qwik serializes state. Do not rely on client-side hiding for privacy.

## Component And UI Rules

- React components used through `qwikify$()` must be self-contained: keep their CSS alongside the component.
- Before creating any shared UI primitive or form element, read [src/design/DESIGN.md](src/design/DESIGN.md) and import primitives from `~/components/ui` only.

## Database And Auth

- Keep schema files in `src/db/schemas/` and use `better-sqlite3` with Drizzle.
- Authentication is magic-link plus OTP email-based; follow the helpers in `src/utils/server-auth.ts` and the existing login flow.
- Uploaded images only store the main path in the database; derive thumbnails with `deriveThumbnailKey(mainPath)` from `~/utils/images`.

## Testing

- Every new feature requires a test plan before implementation begins. The plan must identify: what to test (happy path, edge cases, error states), which test type to use (unit, integration, or e2e), and where the test files live.
- Unit tests go in `tests/unit/` and use Vitest. Use them for pure functions, service logic, and utilities.
- E2E tests go in `tests/e2e/` and use Playwright. Use them for user-facing flows, form submissions, and anything requiring a real browser or server.
- For login-gated flows, use the mailpit flow in `tests/utils/mailpit-client.ts` or the magic-link flow through `/login`.
- Do not ship a feature without at least one automated test covering the primary happy path.
- Run `npm test` (unit) and `npm playwright test` (e2e) before considering a feature complete.

Mailpit API runs at `http://localhost:8025`.

## Verification

- Use Playwright to verify behavior when the user wants runtime confirmation or mentions endpoint behavior.
- For login tests, use the mailpit flow in `tests/utils/mailpit-client.ts` or the magic-link flow through `/login`.