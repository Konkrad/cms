---
status: shipped
code:
  - src/core/admin/sections.ts
  - src/core/admin/dashboard.service.ts
  - src/routes/admin/[scope]/layout.tsx
tags: [foundation, admin]
---
# Admin area

Every scope has its own admin area at `/admin/<scope>` (e.g. `/admin/germany.berlin`). What a person sees there depends on their role on that scope or above ([[scopes-and-roles]]).

```mermaid
flowchart TD
    who{"Role on this scope<br/>or above?"}
    who -- "none" --> no["No access"]
    who -- "coordinator" --> rev["Reviews only"]
    who -- "representative" --> man["Scope sections"]
    who -- "admin / moderator" --> man
    man --> s1["Notes, articles, pages, forms,<br/>members, scope settings,<br/>events, jobs, deals, … (active modules)"]
    who -- "admin / moderator<br/>of the root" --> sys["+ system sections:<br/>users, badges, notifications, payments"]
```

## Rules
- A scope switcher moves between the scopes a person manages; managing a region includes its chapters.
- Everything shown is limited to the scope and the scopes below it. An item from another branch of the tree answers "not found", even by direct address.
- The **system sections** exist only on the root, for platform admins: users (with email addresses and membership tiers), badges, failed notifications and background jobs, payments.
- Modules add their sections; a module decides on which levels it appears (root only, all scopes, or certain kinds).
- The admin area always uses the built-in design; the theme does not apply.

## Decisions
- One admin area per scope instead of one global back office, so chapters manage themselves without seeing other chapters' data.
