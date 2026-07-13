# Qualifications

Despite the name, this isn't specifically about academic degrees — it's a
generic **membership-tier verification workflow**. An admin defines a
*qualification type* representing some criterion; a member submits a claim
against it; an admin reviews and approves or rejects the claim; approval can
upgrade the member's tier and/or assign a tag.

Always managed at `/admin/global/qualifications` — visiting it under any
other group slug redirects there, since qualifications are platform-wide,
not per-community.

## The three pieces

- **Qualification types** (`qualification-types` table) — the admin-defined
  criteria. Each has a `slug`, `label`, `description`, and
  `grants_membership_tier` (`"associated"` or `"full"`) — i.e. what
  membership tier a member is upgraded to once this type is approved for
  them.
- **User qualifications** (`user-qualifications` table) — one row per
  member-claim-against-a-type, with `status` (`pending` / `approved` /
  `rejected`), plus `verified_by` / `verified_at` / `notes` for the review
  trail.
- **Qualification tokens** (`qualification-tokens` table) — time-limited
  (`expires_at`), revocable (`is_active`) tokens scoped to one type. The
  admin panel renders these as **QR codes** pointing at
  `/qualifications/verify/{token}`. The intended use is in-person
  verification — e.g. print/display a QR code at an event or info desk;
  scanning it lets someone self-certify against that qualification type,
  which then lands in the `pending` review queue rather than being
  auto-approved.

## Admin actions

All gated by the general `requireAdmin` check — see [Roles &
Permissions](./roles-and-permissions.md):

- Create / delete qualification types
- Approve / reject a pending user qualification
- Generate / revoke a verification QR token for a type

## Where this lives in code

- Schema: `src/db/schemas/qualification-types.ts`,
  `user-qualifications.ts`, `qualification-tokens.ts`
- Service: `src/services/qualifications.service.ts` (also touches
  `membershipsService` and `userTagsService` — read `approve()` directly if
  you need the exact tier-upgrade/tag-assignment mechanics for a specific
  change)
- Admin UI: `src/routes/admin/[group_slug]/qualifications/index.tsx`
- Public verification page: `src/routes/qualifications/verify/[token]/`
