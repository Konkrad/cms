# Internal documentation

This is an alumni-community platform: members, local communities, events
with paid or free ticketing, elections, jobs, deals, and a page builder for
managing site content.

## Using the platform

| Doc | Read this if you're... |
|---|---|
| [Roles & Permissions](./roles-and-permissions.md) | Trying to understand who can do what — admin, community representative |
| [Admin Guide](./admin-guide.md) | An admin or community representative, want a tour of everything manageable in the admin area |
| [Event & Ticketing Flow](./event-ticketing-flow.md) | Setting up an event, or want to understand checkout/tickets/check-in end to end, with screenshots |
| [Qualifications](./qualifications.md) | Trying to understand the membership-tier verification process |

## Extending / operating the platform

| Doc | Read this if you're... |
|---|---|
| [Building a Custom Theme](./theme-development.md) | Standing up a new deployment with its own branding/theme on this core |
| [Deployment](./deployment.md) | Setting up or operating the Kamal/Docker/Litestream deployment |
| [Event CTA Flow](./event-flow.md) | Modifying the event page's call-to-action logic or the paid-checkout state machine — precise flowcharts of both |
| [Ticket Sales Reasoning](./event-tickets.md) | Modifying the products/inventory-groups schema — the *why* behind that data model |

## The short version

- **Core** (this repo) owns the database, business logic, auth, and the entire
  admin panel. The admin panel is intentionally **not themeable** — it looks
  the same regardless of which deployment/theme runs on top.
- **Theme** (`theme/` in this repo, or a deployment repo's own `theme/`
  overlay) owns everything a logged-out or logged-in *member* sees on the
  public site — the actual look and feel.
- **Deployments** (e.g. a specific alumni chapter's site) are a thin repo that
  supplies its own `theme/` directory, which gets copied on top of a fresh
  checkout of this repo at build time. See [Building a Custom
  Theme](./theme-development.md).
