---
status: shipped
code:
  - src/modules/events/admin/review.tsx
  - src/modules/events/review.ts
  - src/modules/events/debrief.ts
tags: [events, reviews, forms]
---
# Event proposals

An organiser plans an event as a **draft**, submits it, and it is published directly or after a coordinator approves it. After the event, the organiser is asked for a debrief.

## Rules
- Only a draft can be submitted. Status: `draft` → `in_review` → `published`; a rejection returns it to `draft`.
- Whether review is needed is decided by [[review-flow]], never by the events module.
- The scope's active `events.proposal` form (if any) is filled in on submit; its answers are stored with the review.
- On approval, "Post announcement" (on by default) creates a note about the event, authored by the organiser.
- Debrief: a daily schedule asks the organiser of an ended event (up to 30 days ago) to fill in the active `events.debrief` form, once, plus one reminder a week later. After that it shows as overdue in the admin list. Nothing is blocked.

## Decisions
- 2026-10: proposals reuse core reviews and forms instead of an approval flow of their own (#88).
