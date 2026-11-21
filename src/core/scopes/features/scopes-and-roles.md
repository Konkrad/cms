---
status: shipped
code:
  - src/core/scopes/access.ts
  - src/core/scopes/schema/scopes.ts
  - docs/roles-and-permissions.md
tags: [core, scopes, roles]
---
# Scopes and roles

The organisation is **one tree of scopes**: the whole site (root) at the top, then the kinds below it (default: region, then chapter; `SCOPE_KINDS`). Groups, regions and chapters are all scopes. Every piece of content belongs to one scope; see [[visibility]].

## Roles
A role is held on one scope and **applies to that scope and every scope below it**. There is no role on the user itself.

| Role | Can |
|---|---|
| admin, moderator | Same rights: manage the scope and everything below. On the root: platform admin (users, menus, tags, notifications, payments). |
| representative | Manage their scope and below: events, notes, articles, pages, members, sub-scopes. Their public content goes through [[review-flow]]. May only appoint representatives. |
| coordinator | Reviews public content from scopes below. Admin area: the review queue only. |

- Admins/moderators grant every role; representatives only "representative". Nobody revokes their own role.
- **Organiser** is not a role: it is the user who created an event (`events.userId`). Any representative or admin of the scope or above can edit the event too.

## Membership
Members join a chapter (or are added). **Membership counts upward**: a member of Berlin is a member of Germany. New users belong to the root only.

## Data
- `scopes(id, parentId, kind, slug, name, path, …)`: the tree, with the materialized URL path.
- `scope_roles(scopeId, userId, role)`, `scope_memberships(scopeId, userId, …)`.

## Decisions
- 2026-10: groups, regions and chapters became one scope tree; `users.role` was removed (#121).
- Moving or renaming a scope writes redirects, so old URLs keep working.
