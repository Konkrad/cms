---
status: shipped
code:
  - modules.config.ts
  - src/core/router/modules.ts
  - src/core/registry/manifests.ts
  - src/core/registry/active-modules.ts
  - src/core/index.ts
  - biome.json
tags: [architecture]
---
# Application structure

How the CMS is put together. It is one web application (Qwik, server-rendered, SQLite database) made of four layers.

```mermaid
flowchart TB
    browser(["Browser"])
    subgraph app ["One server process"]
        routes["Routes<br/>(addresses, page loading, form handling)"]
        theme["Theme<br/>(how public pages look)"]
        subgraph features ["Features"]
            core["Core<br/>scopes, users, notes & articles, forms,<br/>reviews, payments, notifications, …"]
            modules["Modules<br/>events, jobs, deals, elections,<br/>qualifications, social web"]
        end
        workers["Timers working off<br/>database queues"]
    end
    db[("SQLite database")]
    s3[("S3 storage<br/>(images)")]
    stripe(["Stripe"])
    browser --> routes
    routes --> theme
    routes --> core
    routes --> modules
    modules -- "may only use core's<br/>public toolbox" --> core
    theme -- "only sees prepared data" --> routes
    core --> db
    modules --> db
    core --> s3
    core <--> stripe
    workers --> core
    workers --> modules
```

## The layers
- **Core** is what every installation has: the scope tree and roles ([[scopes-and-roles]]), [[visibility]], users and login, notes and articles, pages, forms, [[review-flow]], [[payments]], [[notifications]], [[background-jobs]].
- **Modules** are optional features. Each one can be switched on or off per installation. A switched-off module disappears from the site (its pages answer "not found", its links and menus vanish), but its data stays, and payments or reviews already under way still finish.
- **Theme** decides how public pages look. It is licensed separately and never touches the database: it only receives data prepared for it. The admin area is not themeable.
- **Routes** connect an address to the code that loads the page or handles the form ([[urls-and-pages]]).

## What a module brings
A module describes itself in one manifest; core reads it and wires everything in.

```mermaid
mindmap
  root((Module))
    Pages
      public pages
      admin sections
      page-builder blocks
    Data
      own tables
      demo data
      image upload folders
    Business hooks
      payment outcomes
      review decisions
      scheduled jobs
    People
      notifications
      questions users must answer
      forms
    Links
      addresses of its items
      sitemap and feeds
    Settings
```

## Rules
- Modules may only use core's public toolbox, never its internals; an automatic check enforces this.
- Only "service" code talks to the database. Pages and actions ask services, and services return only what the viewer may see. This is where privacy is enforced.
- All user-facing text comes from translation catalogs; one language per installation (English or German).
- Which modules are active and which language is used are fixed when the site is built; the server refuses to start with different settings.

## Decisions
- 2026-10: rewrite from one big application into a small core plus optional modules (#121), so installations can leave out what they don't need and features stay separate.
