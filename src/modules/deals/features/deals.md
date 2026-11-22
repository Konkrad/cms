---
status: shipped
code:
  - src/modules/deals/module.ts
  - src/modules/deals/service.ts
  - src/modules/deals/public-deal.ts
  - src/modules/deals/schema.ts
tags: [deals, module]
---
# Deals

Partner offers for members: a discount or perk with a logo, a description and the steps to redeem it.

## Rules
- A deal belongs to a scope; admins of any scope manage their own.
- Deal pages are public. A step can be marked **members only** (e.g. the promo code): guests see that the step exists, but not its content, until they log in.
- A deal with an end date disappears from listings after it; without one it stays.
- Deals appear on their own page and in a page-builder block ([[pages-and-menus]]); the block never shows the steps.

## Decisions
- Public deal pages attract new members, while the actual codes stay behind the login.
- **Open:** deals have no visibility setting; every deal is public.
