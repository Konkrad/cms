---
status: shipped
code:
  - src/core/content/pages.service.ts
  - src/core/content/cms-page.ts
  - src/core/content/menu-items.service.ts
  - src/core/content/menu-links.ts
  - src/core/content/builder
tags: [foundation, content]
---
# Pages and menus

Every scope can have its own pages, built from blocks in a visual editor, and the site has two menus.

## Pages
- A page belongs to a scope and has a short address under it: `/germany/berlin/about`. Only one level deep.
- **Draft** or **published**, and a [[visibility]]: public, members or representatives. A page someone may not open answers "not found" to them.
- Only public pages are in the sitemap.
- Built from **blocks**: title, text, image, video, embed, quote, callout, accordion, button, hero, feature, spacer, plus live blocks (latest posts, upcoming and past events, deals, scopes list, a survey form). Modules add their own blocks; a switched-off module's blocks disappear.
- A scope's home page is generated (its posts, events, members); pages are extra.
- Page addresses never collide with sub-scope names. Renaming a page keeps the old address working ([[urls-and-pages]]).
- Content is cleaned on saving: unsafe HTML and script links are removed.

## Menus
- The site has a **main** and a **footer** menu, managed by platform admins.
- Menu entries are references ("the Berlin scope", "the about page", "events"), so they keep working after renames. Modules add their own entries (e.g. "Events", "My tickets") while switched on.
- A link to a members-only page is shown only to people who may open it.

## Decisions
- One page builder for all scopes, so chapters can make their own pages without help.
- 2026-11: pages got a visibility like posts and events, so a chapter can keep a page for its members.
