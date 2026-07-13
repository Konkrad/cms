# Roles & permissions

There are two independent axes of "who can do what": a **platform-wide role**
stored on the user, and a **per-group representative** relationship. Most
practical admin questions ("can this person edit that group's events?") are
actually answered by the second one, not the first.

## Platform roles

`users.role` is one of `user`, `moderator`, `admin` (default `user`). This is
a single global value — there's no per-group platform role.

- **`user`** — a regular member. No admin access at all.
- **`moderator`** and **`admin`** — both pass the general `requireAdmin` /
  `isAdmin` check (`src/utils/server-auth.ts`) used to gate most admin
  actions and the qualifications system. For most day-to-day purposes,
  **moderator and admin behave identically**.

There is one place where they diverge, and it's worth knowing about because
it's easy to trip over: `requireGroupAdmin` and the `[group_slug]` admin
layout (`src/utils/access-control.ts`) treat the special slug `global` as
requiring **`role === "admin"` exactly** — a moderator is *not* granted
access to `/admin/global/**`. So a moderator can, for example, approve
qualifications (gated by the looser `requireAdmin`) but cannot get into the
global admin dashboard the same way an admin can. If you're assigning the
`moderator` role expecting full parity with `admin`, double check the
specific action you care about isn't one of the stricter, `isPlatformAdmin`
/ `requireGroupAdmin`-gated ones.

Note also: being platform `admin` does **not** automatically make someone a
representative of every group (see below). An admin who isn't also
promoted as a representative of a specific group will be redirected out of
that group's `/admin/{slug}/**` panel — admin rights for a *specific* group
come from the representative relationship, not the platform role, except
for the `global` scope itself.

## Group representatives ("local reps")

This is the real mechanism behind "who can manage community X." It's a
membership row, not a role value: the `group_representatives` table links a
`user_id` to a `group_id` (a user can represent more than one group). It's
managed via `groupRepresentativesService` — promote a member to represopen
`/admin/{group_slug}/groups/[id]/members`.

Admins promote a member to representative from
`/admin/{group_slug}/groups/[id]/members`. A group representative can then
access `/admin/{their-group-slug}/**` and manage everything scoped to that
one group: its events, its page content (if the group has one), its
members. They cannot touch other groups' admin panels, and they cannot
reach `/admin/global/**`.

## Summary table

| Who | Platform role | Can access | Cannot access |
|---|---|---|---|
| Member | `user` | Public site, own profile | Any `/admin/**` route |
| Local rep | usually `user` | `/admin/{their-group}/**` | Other groups, `/admin/global/**` |
| Moderator | `moderator` | Most `requireAdmin`-gated actions (e.g. qualifications) | `/admin/global/**` dashboard itself |
| Platform admin | `admin` | `/admin/global/**`, plus any group they're also a rep of | Nothing, except groups they haven't been promoted into (see caveat above) |

## Where this is enforced in code

- `src/utils/server-auth.ts` — `requireAuth`, `requireAdmin`, `isAdmin`
  (moderator-inclusive). Use these for anything not group-scoped.
- `src/utils/access-control.ts` — `requireGroupAdmin`, `isPlatformAdmin`
  (admin-only, no moderator), `canManageGroupContent`. Use these for any
  action under `admin/[group_slug]/**`.
- Every mutating action and API handler is expected to call one of these as
  its **first statement**, before any `try` block — see the Security
  section of the root `CLAUDE.md` for the reasoning (a `routeAction$` runs
  *before* the route's loaders, so a loader-level redirect does not protect
  an action).
