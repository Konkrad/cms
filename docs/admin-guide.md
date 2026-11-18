# Admin guide

A tour of everything manageable in the admin area. See [Roles &
Permissions](./roles-and-permissions.md) for who can see what. Every group
has its own admin area (`/admin/<group>`, e.g. `/admin/germany.berlin`;
`/admin/root` for the whole site); `/admin` opens the highest group you
manage, and the "Switch group" menu jumps between the groups you manage.

The admin area deliberately looks the same on every deployment of this
platform, regardless of the public site's branding, so this guide applies
no matter which community or organization you're managing.

![Admin dashboard nav](./images/admin-event-create.png)
*The admin menu of the whole site: Dashboard, Users, Reviews, Notes, Articles,
Events, Forms, Pages, Groups, Deals, Jobs, Elections, Qualifications, Payments
(every payment with its status, filtered by module and status, linked to its item,
with Refund) and Notifications (failed messages, scheduled jobs and handlers). A chapter's admin
shows Dashboard, Members, Reviews, Notes, Articles, Events, Forms, Pages, Deals,
Jobs, Elections and Group settings, limited to that chapter and the groups below
it.*

## Content

- **Notes** — short news of the site or a group ("Doors open at 18:00"): text and
  links only, at most 1000 characters, no title and no image. Write one in the quick
  form at the top of the Notes list. Anything longer is an article.
- **Articles** — long-form news with a title, an optional featured image (shown on
  the article, its card and the hero block, and when the article is shared) and full
  formatted text. Create them under Articles → New article.
- Notes and articles appear together, newest first, in the news (the **Stream**
  page block, a group's page, the archive at `/archive/all`). A Stream block can also
  show notes only (a "short stream") or articles only; the archive has
  `/archive/notes` and `/archive/articles`. Both can be *about* an item (pick it
  under "About" when editing), such as an event: they then also show under it.
- **Event updates** — on an event's admin page, the **Updates** tab has *Write note*
  (e.g. "Doors open at 18:00") and *Write article* (the announcement, the recap).
  They show under the event on its page, newest first.
- **Pages** — full pages (like the homepage, "About Us," or a community's
  landing page) built with a visual, drag-and-drop page builder out of
  reusable content blocks (a hero banner, an events list, a text section,
  and so on). Every group has its own pages, served under its address
  (`/germany/berlin/about`); listing blocks on them show that group's
  content. The site menus are managed on the top level only.
- **Links and addresses** — every event, note, article, job, deal and election has one
  address under the group that owns it (`/germany/berlin/events/summer-bbq`);
  the same item opened under another address is forwarded there. Links you
  pick in a menu, a page block's link field or the "Link the selected text"
  search above the text editor point at the item itself, not at its address:
  renaming or moving a group, or renaming a page, never breaks them, and a
  link to something that was deleted simply disappears (its text stays). In a
  menu's URL field you can also type a group as `root/germany/berlin` or its
  listing as `root/germany/berlin:events`.
- **Visibility** — notes, articles and events are *Public* (everyone; also listed on
  every group above), *Members* (members of the group and the groups below
  it) or *Representatives*. A representative's new public content is published
  after review (see Reviews below). A group's pages list its own items, those of the
  groups above it (labelled with their source) and the public items of the
  groups below it.
- **Deals** — member discounts and perks listings.
- **Jobs** — the job board. Members can submit listings from the public
  site; they show up here as pending until an admin approves them.

## Reviews

The **Reviews** section of a group lists what waits for your decision: public
notes, articles and event proposals from the groups below that you may decide
(as a coordinator, an admin above them or a platform admin), with the proposal
answers. *Approve* publishes the item (an approved event also gets its
announcement note); *Reject* needs a comment, which the author sees. Below the
queue, **Your submissions** shows what you submitted, its state and the
reviewer's comment. Coordinators see only this section. See
[Roles & Permissions](./roles-and-permissions.md#reviews) for who reviews what.

## People

- **Users** — the member directory.
- **Groups / Group settings** — the group's name, description and page
  images, its sub-groups (create a region or chapter with a URL slug),
  deleting an empty group and, for platform admins, moving a group.
- **Members** (below the top) — the group's members, adding and removing
  them, and granting or revoking roles (see [Roles &
  Permissions](./roles-and-permissions.md)).
- **Tags** — freeform labels applied to members or content, which can also
  be assigned automatically (e.g. approving a qualification can assign a
  tag — see [Qualifications](./qualifications.md)).

## Events

The full event lifecycle — see [Event & Ticketing
Flow](./event-ticketing-flow.md) for a detailed, illustrated walkthrough.
Once an event exists, its management page has tabs for:

- **Details / Edit** — title, description, date & time, location, visibility
- **Review** — the event's state (draft, in review, published) and the
  reviewer's comment. A representative's new public event starts as a draft:
  fill in the proposal (the active *Event proposal* form) and submit it for
  review; "Post an announcement note" (on by default) adds a note about the event
  once it is approved. After the event, the organiser is asked by email (once,
  and reminded a week later) to fill in the *Event debrief* here; the reviewer is
  told when it is in. The proposal and debrief answers are shown here only.
  The events list shows overdue debriefs (asked a week ago or more).
- **Products** — ticket types and how many are available (see the
  ticketing doc for how this works)
- **Participation** — who's RSVP'd (separate from paid ticket sales), with each person's food preference and photo consent
- **Tickets / Scan** — issued tickets, and the QR check-in scanner for the door
- **Comp Tickets** — issue free tickets directly, without going through checkout
- **Transactions** — the event's orders (paid, pending, canceled, refunded);
  the payments themselves are under **Payments** in the site admin
- **Photos** — the event's photo gallery

## Governance

- **Elections** — community leadership election cycles. Create a cycle,
  then add the positions members can apply for.

## Forms

A form builder for anything that collects structured answers: surveys (a page
of their own and the survey page block), the onboarding survey, event
proposals and debriefs. Every group has its own forms; responses can be viewed
and exported.

- **Purpose** — a form used by a workflow has a purpose (*Onboarding survey*,
  *Event proposal*, *Event debrief*, …). Under **Active forms**, each group
  picks the form a workflow uses for it and the groups below; a group that
  picks none uses the one of the nearest group above. A group can pick its own
  forms or those of the groups above it.
- **Locked forms** — once a form has an answer its questions can no longer be
  changed (its title and settings can), so stored answers always match their
  questions. To change the questions, **Duplicate** the form, edit the copy and
  make it the active one.
- Answers are checked on the server against the questions; text answers are
  stored and shown as plain text.
- **Onboarding survey** — while an *Onboarding survey* form is active for the
  whole site, every member fills it in once during setup (after their profile
  and location), before they can use the site. With no active onboarding form
  the step is skipped.

## Qualifications

See [Qualifications](./qualifications.md) for the full picture — in short,
this manages a membership-tier verification process: admin-defined
qualification types, member claims against them, an approve/reject review
queue, and QR codes for verifying someone in person. Always managed
platform-wide, even for a community representative.
