---
status: shipped
code:
  - src/core/notifications/notify.ts
  - src/core/notifications/worker.ts
  - src/core/notifications/addressing.ts
  - src/core/notifications/core-notifications.ts
tags: [core, notifications]
---
# Notifications

Every email and Telegram message (except the login email) goes through one system: code calls `notify(id, { to, data })`, a row is written to the outbox, and a background worker sends it.

## Rules
- Each notification is declared once (`defineNotification`, in core or a module manifest): its channels and whether users may turn it off (`optional`).
- Recipients are users (email to their address) or **ops targets**: `ops` is the team Telegram channel (`TELEGRAM_CHANNEL_ID`), used e.g. for sale alerts in [[ticket-checkout]].
- Optional notifications carry a signed one-click unsubscribe link; users manage them in their profile.
- Failed sends are retried with growing delays (30 s, 1 min, 2 min … up to 1 h), then marked failed; root admins see failures at `/admin/root/notifications`.
- The login email is the only one sent directly, because the user waits for it.

## Data
- `notification_outbox`: one row per message to send (status, attempts, next try).
- `notification_preferences(userId, notificationId, channel, enabled)`: a user's choices for optional notifications.

## Decisions
- Outbox instead of sending inline: a slow or failing mail server never breaks a page or a payment handler, and nothing is lost on a crash.
