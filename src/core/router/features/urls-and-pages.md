---
status: shipped
code:
  - src/routes/plugin@scope.ts
  - src/routes/[...path]/index.tsx
  - src/core/refs
  - src/core/router/redirects.service.ts
tags: [architecture, urls]
---
# Addresses and pages

Every item has exactly one address, and it shows the scope it belongs to ([[scopes-and-roles]]): `/germany/berlin/events/summer-party`.

## How an address is answered

```mermaid
flowchart TD
    req["/germany/berlin/events/summer-party"] --> old{Old address<br/>that moved?}
    old -- yes --> r301["Permanent redirect<br/>to the new address"]
    old -- no --> split["Split: scope /germany/berlin<br/>+ rest /events/summer-party"]
    split --> find{"Which page<br/>matches the rest?"}
    find -- "a module page" --> mod["Events: the event page"]
    find -- "nothing left" --> home["Berlin's home page"]
    find -- "a page slug" --> cms["Berlin's own page"]
    mod --> check{"Viewer may see it?"}
    check -- no --> nf["Not found"]
    check -- yes --> canon{"Is this the<br/>item's own address?"}
    canon -- no --> r301b["Redirect to it<br/>(e.g. reached via Germany)"]
    canon -- yes --> render["Page rendered<br/>with the theme"]
```

Who may see what: [[visibility]].

## Rules
- **One address per item**, under the scope that owns it. Reaching it any other way redirects there.
- **Moving or renaming** a scope or a page records the old address, which keeps redirecting.
- **Links are stored as references, not addresses.** A menu entry, a link in an article or in an email points to "event 42" or "the Berlin scope"; the current address is filled in when the page is shown. Renames never break links.
- Page slugs and scope names never collide, so `/germany/berlin/about` is always unambiguous.
- The admin area lives at `/admin/<scope>` (e.g. `/admin/germany.berlin`) and shows what the viewer's role on that scope allows.

## Decisions
- 2026-10: addresses follow the scope tree; links are stored as references and resolved on display, so a moved chapter breaks nothing (#121).
