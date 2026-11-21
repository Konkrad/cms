---
status: shipped
code:
  - src/core/scopes/visibility.ts
  - src/core/scopes/access.ts
tags: [core, scopes, visibility]
---
# Visibility

Who sees a piece of content (notes, articles, pages, events, jobs, deals, …). Every item has a scope ([[scopes-and-roles]]) and one of three visibilities.

## Rules
- `public`: everyone. `members`: members of the scope (or below, since membership counts upward) and role holders. `representatives`: role holders only.
- A scope's listings show its own and its ancestors' items by visibility, plus **public** items from scopes below. Members-only items never travel upward.
- Which visibilities an author may pick depends on their role (`allowedVisibilities`).
- Public content from people below coordinator level goes through [[review-flow]] first; until approved it is hidden from everyone but the author and the reviewers.

## Decisions
- One filter (`scopeContentFilter`) for every listing, so no list decides visibility on its own.
