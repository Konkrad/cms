---
status: shipped
code:
  - src/core/notifications/notify.ts
  - src/core/notifications/worker.ts
  - src/core/notifications/addressing.ts
  - src/core/notifications/core-notifications.ts
tags: [foundation, notifications]
---
# Notifications

Every email and Telegram message goes through one system. A feature only says *"send notification X to Y"*; the message is written to an outbox in the database, and a timer in the server delivers it a few seconds later ([[background-jobs]]).

```mermaid
flowchart LR
    F["A feature<br/>(e.g. ticket sold)"] --> O[("Outbox")]
    O --> W["Timer<br/>(every 5 seconds)"]
    W --> E["Email to a user"]
    W --> T["Team Telegram channel"]
    W -- "failed" --> RETRY["Retry later:<br/>30 s, 1 min, 2 min … 1 h"] --> O
    W -- "5th failure" --> ADMIN["Shown to platform admins"]
```

## Rules
- Every notification is declared once, with its channels and whether people may turn it off.
- Recipients are users (email) or the **team channel** on Telegram (e.g. the sale alert in [[ticket-checkout]]).
- Notifications people may turn off carry a one-click unsubscribe link; users manage them in their profile.
- The **login email is the only exception**: it is sent immediately, because the user is waiting for it.
- Platform admins see failed messages and can retry them.

## How it is stored
One outbox row per message (with its status and attempts), plus each user's choices for the notifications they may turn off.

## Decisions
- An outbox instead of sending immediately: a slow or broken mail server never breaks a page or a payment, and no message is lost when the server restarts.
