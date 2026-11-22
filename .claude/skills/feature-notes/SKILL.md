---
name: feature-notes
description: Use when a change alters what the CMS does or why (a rule, a permission, a status flow, a price or capacity rule, who gets notified, what is visible to whom), when adding a module or a core area, when the feature-notes Stop hook or pre-commit reminder lists a note, or when writing or editing anything in `<area>/features/*.md` or FEATURES.md.
---

# Feature notes

The knowledge base of the CMS: one Markdown note per feature, next to its code (`src/core/<area>/features/`, `src/modules/<id>/features/`), opened as an Obsidian vault from `FEATURES.md`. Readers are people (the maintainer, admins) and agents. Notes say **what happens and why**; the code says how.

## When a note must change

Update the note **in the same commit** as the code when any of these changes:
- a rule a person would notice (who may do what, what is visible, limits, prices, deadlines, retries),
- a status flow (new state, new transition),
- who gets which message,
- a decision with a reason (record it under Decisions, with the date and issue/PR if any),
- an open problem you found or fixed (add or remove it under Decisions as **open**).

A refactor, a bug fix that restores the documented behaviour, or styling changes nothing in the note: say so in one line and move on.

The Stop hook (`scripts/feature-notes-drift.mjs --hook`) lists notes whose `code:` files changed while the note did not, once per stop. Review each listed note; don't edit it just to silence the hook.

## Where it goes

- One note per feature, in the `features/` folder of the area that **owns** the behaviour. A cross-cutting rule lives with its owner (review rules in `core/reviews`), others link to it.
- A module gets an overview note named after the module (`events.md`) linking to its detail notes. New notes are listed in `FEATURES.md` (the test fails otherwise).
- Note names are unique across the repo (they are the `[[link]]` targets).

## Template

```markdown
---
status: shipped        # shipped | partial | planned
code:                  # the files where the rules live; specific files, not whole folders
  - src/core/payments/payments.ts
tags: [foundation | architecture | <module>, …]
---
# Title

One or two sentences: what it is for, for whom. Links to the notes it builds on.

(diagram, if it explains the flow better than words)

## Rules
- Short bullets, business language.

## How it is stored        (only if it helps to understand the feature)
Plain words or an ER diagram with readable entity names.

## Decisions
- 2026-10: what was decided, and why (#issue).
- **Open:** a known gap or an undecided question.
```

## Style

- Business language. No function, column, env or file names in the text (they belong in `code:`); say "the hourly job closes abandoned checkouts", not `expireStalePayments`.
- Say the reason behind a rule whenever it is known; mark a reason you reconstructed from the code as such.
- Check every rule against the code before writing it; don't copy CLAUDE.md or old docs unchecked.
- Link instead of repeating: each fact lives in one note.
- Keep it short: a note is read in two minutes.

## Diagrams (Mermaid, rendered by Obsidian and GitHub)

- `stateDiagram-v2` for statuses, `sequenceDiagram` for flows between people and systems, `flowchart` for decisions and structure, `erDiagram` for data (entity names like `CAPACITY_POOL`, underscores, no hyphens).
- Line breaks in labels with `<br/>`, never `\n`. Quote labels with punctuation. Give subgraphs an id: `subgraph roles ["Title"]`.
- Keep a diagram under ~12 nodes; split it otherwise.

## Checks

- `tests/unit/feature-notes.spec.ts`: `code:` paths exist, `[[links]]` resolve, every note is in `FEATURES.md`, every module and core area (except the listed infrastructure ones) has a note.
- `.githooks/pre-commit` prints the same drift reminder for staged files (never blocks).
- Run just these: `npx vitest run tests/unit/feature-notes.spec.ts`.
