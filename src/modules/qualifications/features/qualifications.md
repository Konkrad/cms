---
status: shipped
code:
  - src/modules/qualifications/module.ts
  - src/modules/qualifications/service.ts
  - src/modules/qualifications/pages.ts
  - docs/qualifications.md
tags: [qualifications, module]
---
# Qualifications

A general way to verify members against a criterion (e.g. "is a student", "completed the training") and reward them: approval can raise their [[membership-tiers]] and give them a badge ([[badges]]).

```mermaid
sequenceDiagram
    actor Admin
    actor Member
    participant CMS
    Admin->>CMS: define a qualification (tier it grants)
    Admin->>CMS: create a time-limited QR code (optional)
    Member->>CMS: claim it (or scan the QR code at a desk)
    CMS->>CMS: claim waits as pending
    Admin->>CMS: approve or reject
    CMS-->>Member: tier raised, qualification badge given
```

## Rules
- Managed by platform admins only; qualifications are site-wide, not per scope.
- A member has one claim per qualification: pending, approved or rejected.
- QR codes expire after the chosen number of hours and can be revoked. Scanning one only creates a pending claim; it never approves by itself.
- Approval raises the tier if the qualification grants a higher one, never lowers it.

## Decisions
- QR codes for in-person checks (at an event or info desk), with an admin still approving each claim.
