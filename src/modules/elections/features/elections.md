---
status: shipped
code:
  - src/modules/elections/module.ts
  - src/modules/elections/service.ts
  - src/modules/elections/pages.ts
  - src/modules/elections/schema.ts
tags: [elections, module]
---
# Elections

Board elections: admins open an election with positions, members apply as candidates, admins approve candidates, and voting happens on an external voting tool.

```mermaid
stateDiagram-v2
    [*] --> draft: admin creates election and positions
    draft --> open: applications open
    open --> voting: applications closed, link to the voting tool
    voting --> closed: done
```

## Rules
- Election pages need a login. A draft election is visible to admins only.
- **Applying:** while an election is open, a logged-in member applies for a position with three short answers (why, experience, goals). An election can require a membership tier ([[membership-tiers]]); without it, applying is refused.
- A position can state how many candidates it takes.
- Admins approve or reject applications; a rejection can carry a note that only the applicant sees.
- Approved candidates are shown on the election page. People see their own applications and their status.
- The actual vote happens outside the CMS, through the voting link of the election.
- Admins of any scope run elections for their scope.

## Decisions
- Voting itself is left to a dedicated tool; the CMS handles candidates and information.
- **Open:** elected candidates do not get a board badge automatically ([[badges]]).
