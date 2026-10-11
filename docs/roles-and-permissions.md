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
  it: events, posts, pages, jobs, deals, elections, forms, sub-groups and
  members. Their public content needs a coordinator or admin (until reviews
  exist they can publish to members or representatives only). Representatives have no
  users directory: they see the members of their own groups only, and they
  can only appoint other representatives.
- **Coordinator** — reviews public content from the groups below theirs; no
  admin access.

Admins and moderators of a group can grant every role on it; representatives
can grant only the representative role. Nobody can revoke their own role.

## Membership

Members join chapters themselves (or are added by a manager). Membership
counts **upward**: a member of Berlin counts as a member of Germany, so
members-only posts and events of Germany are visible to Berlin's members.
New users belong to the whole site only.

## Summary

| Who | Can manage | Cannot manage |
|---|---|---|
| Member | Their own profile, RSVPs, tickets | Anything in an admin area |
| Representative of a group | That group and the groups below: events, posts, forms, sub-groups, members, other representatives | Sibling or parent groups, the users directory, system sections |
| Admin / moderator of a group | The same, plus granting every role | Groups outside their branch |
| Platform admin (admin of the top) | Everything, including the system sections and moving groups | — |
