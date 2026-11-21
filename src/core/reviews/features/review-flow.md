---
status: shipped
code:
  - src/core/reviews/reviews.ts
  - src/core/content/content-review.ts
  - src/routes/admin/[scope]/reviews/index.tsx
tags: [core, reviews, scopes]
---
# Review flow

Content from people below coordinator level is checked by a coordinator above before the public sees it. Used by notes, articles and [[event-proposals]].

## Rules
- Review is needed when the item is **public** and the author is **below coordinator** of the owning scope (roles inherit downward). Non-public items never need review.
- Deciders: coordinators/admins of a scope **strictly above** the item's scope, and root admins. Never the submitter, never the item's own scope's representatives.
- The request email goes to the coordinators of the nearest scope above that has any; root admins otherwise.
- The decision runs the owner's `onApproved` / `onRejected` handler, retried until it succeeds.
- Queue: `/admin/<scope>/reviews`.

## Decisions
- Modules never decide whether review is needed themselves (`reviews.isRequired`), so the rule stays the same everywhere.
