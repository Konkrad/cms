# Admin guide

A tour of everything manageable in the admin area. See [Roles &
Permissions](./roles-and-permissions.md) for who can see what — a community
representative sees the same style of menu as a platform admin, just scoped
to their one community.

The admin area deliberately looks the same on every deployment of this
platform, regardless of the public site's branding, so this guide applies
no matter which community or organization you're managing.

![Admin dashboard nav](./images/admin-event-create.png)
*The admin menu: Dashboard, Users, Posts, Events, Forms, Pages, Groups,
Deals, Jobs, Elections, Qualifications. A community representative sees the
same menu, scoped to their one community.*

## Content

- **Posts** — blog-style news posts. Create, edit, and publish.
- **Pages** — full pages (like the homepage, "About Us," or a community's
  landing page) built with a visual, drag-and-drop page builder out of
  reusable content blocks (a hero banner, an events list, a text section,
  and so on).
- **Deals** — member discounts and perks listings.
- **Jobs** — the job board. Members can submit listings from the public
  site; they show up here as pending until an admin approves them.

## People

- **Users** — the member directory.
- **Groups** — manage communities: their details, and their member list —
  which is also where you promote a member to be a representative of that
  community (see [Roles & Permissions](./roles-and-permissions.md)).
- **Tags** — freeform labels applied to members or content, which can also
  be assigned automatically (e.g. approving a qualification can assign a
  tag — see [Qualifications](./qualifications.md)).

## Events

The full event lifecycle — see [Event & Ticketing
Flow](./event-ticketing-flow.md) for a detailed, illustrated walkthrough.
Once an event exists, its management page has tabs for:

- **Details / Edit** — title, description, date & time, location, visibility
- **Products** — ticket types and how many are available (see the
  ticketing doc for how this works)
- **Participation** — who's RSVP'd (separate from paid ticket sales)
- **Tickets / Scan** — issued tickets, and the QR check-in scanner for the door
- **Comp Tickets** — issue free tickets directly, without going through checkout
- **Transactions** — payment records
- **Photos** — the event's photo gallery

## Governance

- **Elections** — community leadership election cycles. Create a cycle,
  then add the positions members can apply for.

## Forms

A generic form builder for anything that collects structured answers from
a member — onboarding surveys, event feedback, and so on. Each form's
responses can be viewed and exported. The built-in onboarding form is a
form like any other; its answers also show up, nicely formatted, on a
member's own profile.

## Qualifications

See [Qualifications](./qualifications.md) for the full picture — in short,
this manages a membership-tier verification process: admin-defined
qualification types, member claims against them, an approve/reject review
queue, and QR codes for verifying someone in person. Always managed
platform-wide, even for a community representative.
