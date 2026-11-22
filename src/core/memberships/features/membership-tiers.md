---
status: partial
code:
  - src/core/memberships/memberships.service.ts
  - src/core/memberships/schema.ts
  - src/routes/admin/[scope]/users/index.tsx
tags: [foundation, accounts]
---
# Membership tiers

A person's formal membership of the organisation: **none**, **associated** or **full**. This is different from joining a chapter ([[scopes-and-roles]]), which anyone can do.

```mermaid
flowchart LR
    none["No tier"] --> assoc["Associated"] --> full["Full"]
    qual(["Approved qualification"]) -. "raises, never lowers" .-> assoc
    qual -.-> full
    admin(["Platform admin"]) -- "sets any tier" --> full
```

## Rules
- Platform admins set or remove a person's tier in the users list.
- An approved qualification can raise the tier automatically, never lower it ([[qualifications]]).
- "Full" includes everything "associated" allows.
- What a tier unlocks today: standing in elections that require a tier ([[elections]]).

## Decisions
- **Open:** a tier can carry an end date, but nothing checks it yet: an expired membership still counts.
