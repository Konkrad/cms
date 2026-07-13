# Admin guide

Everything in this doc lives under `/admin/{group_slug}/**` — either a
specific community's slug (for a local rep) or the special slug `global`
(platform admin, `/admin/global/**`). See [Roles &
Permissions](./roles-and-permissions.md) for who can get where.

The admin panel is intentionally **not themeable** — it's core UI, deliberately
plain and identical across every deployment, so this guide applies regardless
of which theme/branding is running on the public site.

![Admin dashboard nav](./images/admin-event-create.png)
*The admin nav bar (top): Dashboard, Users, Posts, Events, Forms, Pages,
Groups, Deals, Jobs, Elections, Qualifications. A local rep sees the same
nav, scoped to their one group.*

## Content

- **Posts** (`posts/`) — blog-style news posts. Create/edit/list.
- **Pages** (`pages/`) — CMS pages built with a visual, block-based page
  builder (`pages/[id]/builder`). This is how pages like the homepage,
  "About Us," or a community's landing page get assembled from blocks
  (hero sections, event lists, text blocks, etc. — see [Building a Custom
  Theme](./theme-development.md) for what a "block" is).
- **Deals** (`deals/`) — member discounts/perks listings.
- **Jobs** (`jobs/`) — the job board. Members can submit listings from the
  public site; they land here as `pending` until an admin approves them.

## People

- **Users** (`users/`) — member directory and management.
- **Groups** (`groups/`) — local community CRUD. `groups/[id]/edit` for
  group details, `groups/[id]/members` for membership *and* for promoting
  a member to representative (see [Roles &
  Permissions](./roles-and-permissions.md)).
- **Tags** (`tags/`) — freeform tags applied to users/content, also used as
  a target for automated tag-assignment rules (e.g. qualification approval
  can assign a tag — see [Qualifications](./qualifications.md)).

## Events

- **Events** (`events/`, then `events/[id]/**`) — the full event lifecycle.
  See [Event & Ticketing Flow](./event-ticketing-flow.md) for the detailed
  walkthrough; short version of the sub-tabs once an event exists:
  - `details` / `edit` — title, description, date/time, location, visibility
  - `products` — ticket types and capacity (inventory groups + products)
  - `participation` — RSVP tracking (separate from paid tickets)
  - `tickets` / `scan` — issued tickets, and the QR check-in scanner for the door
  - `comp-tickets` — issue free/complimentary tickets directly, bypassing checkout
  - `transactions` — payment records
  - `photos` — event photo gallery

## Governance

- **Elections** (`elections/`) — group leadership election cycles.
  `elections/new` creates a cycle; `elections/[id]` manages it, and
  `elections/[id]/positions/new` adds candidate positions members can apply
  for.

## Forms

- **Forms** (`forms/`) — a generic form builder (onboarding surveys, event
  feedback, etc. — anything that collects structured answers from a
  member). `forms/[id]/responses` shows submissions with CSV export.
  The built-in onboarding form (system key `onboarding`) is a form like any
  other, just flagged so its answers also populate the "Relations /
  Affiliation" section on a member's own profile.

## Qualifications

See [Qualifications](./qualifications.md) for the full picture — in short,
this manages a membership-tier verification workflow: admin-defined
qualification *types*, member *claims* against them, an approve/reject
review queue, and QR-code tokens for in-person verification. Always lives
under `/admin/global/qualifications` regardless of which group slug you
started from.

## A note on `requireAdmin` vs `requireGroupAdmin`

If you're building a new admin feature: anything scoped to one group's data
goes under `admin/[group_slug]/**` and is gated with `requireGroupAdmin`;
anything platform-wide (users, qualifications, global settings) is gated
with the plain `requireAdmin`. Getting this wrong is the most common way a
local rep either can't reach a feature they should have, or — worse — can
reach a feature they shouldn't.
