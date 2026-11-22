---
status: shipped
code:
  - src/core/tags/user-tags.service.ts
  - src/core/tags/schema
  - src/modules/events/services/tag-rules.ts
tags: [foundation, accounts]
---
# Badges

Labels on a person's public profile: "Board member", "Attended 5 events", a verified qualification.

## Where badges come from

| Kind | Given by |
|---|---|
| Participation | Automatically, once a day and on each RSVP, from the events a person took part in ([[events]]) |
| Qualification | When a qualification claim is approved ([[qualifications]]) |
| Board, custom | Platform admins, by hand, from badges they define in the badges section |

## Rules
- Badges are public: they appear on the person's profile.
- Platform admins define custom badges and give or take them away in the users list.
- A person has each badge at most once.

## Decisions
- One badge system for all sources, so a profile shows everything in one place.
- 2026-11: winning an election does not give a board badge automatically; this is not wanted ([[elections]]), admins add it by hand.
