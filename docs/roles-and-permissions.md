# Roles & permissions

The organisation is one tree of **groups**: the whole site at the top, then
regions, then local chapters (the kinds are a deployment setting). What
someone can manage depends on the **roles** they hold on groups in that tree;
there is no separate "account type".

## Roles

A role is granted on one group and applies to that group **and every group
below it**: an admin of a region is an admin of all its chapters.

- **Admin** and **Moderator** — the same rights: the group's admin area and
  everything below it. An admin or moderator of the top of the tree is a
  **platform admin**: they also get the system sections (users, site menus,
  tags, notifications, qualifications) and can move groups or change their
  URL (old URLs keep working through redirects).
- **Representative** ("local rep") — manages their group and the groups below
  it: events, notes, articles, pages, jobs, deals, elections, forms, sub-groups and
  members. Their **public** notes, articles and events are published only after a
  coordinator (or an admin) above them approves them (see Reviews below);
  members-only content is published directly. Representatives have no
  users directory: they see the members of their own groups only, and they
  can only appoint other representatives.
- **Coordinator** — reviews public content from the groups below theirs. Their
  admin area has the **Reviews** section only (`/admin` takes them there).

Admins and moderators of a group can grant every role on it; representatives
can grant only the representative role. Nobody can revoke their own role.

## Reviews

Public content from a group is listed on every group above it, so a
representative's new public note, article or event waits for review:

- It stays hidden (no listing, news, search, sitemap or group page) and its
  address answers "not found", except for its author and its reviewers, who can
  preview it.
- The coordinators of the nearest group above that has any get an email (it
  cannot be muted); without coordinators above, the platform admins do.
- Coordinators of any group above, admins and moderators above and platform
  admins can decide it under **Reviews**: approve, or reject with a comment.
  Nobody decides their own submission, and the group's own representatives
  cannot approve it. The author gets an email either way.
- Rejected: the author changes it and saves it again (an event: submits the
  proposal again), which sends it back to review.
- Content by a coordinator, admin or moderator of the group or above needs no
  review, members-only content neither, and edits to approved content are
  published directly.

## Membership

Members join chapters themselves (or are added by a manager). Membership
counts **upward**: a member of Berlin counts as a member of Germany, so
members-only notes, articles and events of Germany are visible to Berlin's members.
New users belong to the whole site only.

## Summary

| Who | Can manage | Cannot manage |
|---|---|---|
| Member | Their own profile, RSVPs, tickets | Anything in an admin area |
| Coordinator of a group | Reviews of public content from the groups below | Anything else in an admin area |
| Representative of a group | That group and the groups below: events, notes, articles, forms, sub-groups, members, other representatives (public content after review) | Sibling or parent groups, the users directory, system sections |
| Admin / moderator of a group | The same, plus granting every role | Groups outside their branch |
| Platform admin (admin of the top) | Everything, including the system sections and moving groups | — |
