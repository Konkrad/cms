---
status: shipped
code:
  - src/modules/deals/module.ts
  - src/modules/deals/service.ts
  - src/modules/deals/public-deal.ts
  - src/modules/deals/schema.ts
  - src/modules/deals/pages.ts
tags: [deals, module]
---
# Deals

Partner offers for members: a discount or perk with a logo, a description and the steps to redeem it.

## Rules
- A deal belongs to a scope; admins of any scope manage their own.
- A deal has a [[visibility]]: public, members or representatives. A deal someone may not see is not listed for them and its page answers "not found".
- A step can be marked **log in to see** (e.g. the promo code): guests see that the step exists, but not its content, until they log in.
- A deal can **require a membership tier** ([[membership-tiers]]), like elections: everyone who may see the deal sees its name and description, but its steps only show to people with that tier (full includes associated). Others see which membership unlocks it.
- A deal with an end date disappears from listings after it; without one it stays.
- Deals appear on their own page and in a page-builder block ([[pages-and-menus]]); the block never shows the steps.

## Decisions
- Public deal pages attract new members, while the actual codes stay behind the login.
- 2026-11: deals got a visibility and an optional required tier, so partners can offer perks to members or to full members only; the deal stays visible as an incentive to become one.
