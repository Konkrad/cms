---
status: shipped
code:
  - src/core/scheduler/scheduler.ts
  - src/core/scheduler/core-schedules.ts
  - src/core/notifications/worker.ts
  - src/entry.node-server.tsx
tags: [architecture, background]
---
# Background jobs

Work that must not happen while a visitor waits, or must happen without a visitor at all. Two workers run inside the server process.

```mermaid
flowchart LR
    subgraph outbox ["Outbox worker (every 5 s)"]
        o1["Send queued emails<br/>and Telegram messages"]
    end
    subgraph sched ["Scheduler (every 30 s)"]
        s1["Follow-up work<br/>after a payment or review"]
        s2["Recurring jobs"]
    end
    pay(["Payment confirmed"]) --> s1
    rev(["Review decided"]) --> s1
    s1 --> ev["e.g. issue tickets,<br/>publish the event"]
    s2 --> j1["hourly: close abandoned checkouts"]
    s2 --> j2["daily: participation badges"]
    s2 --> j3["daily: debrief requests"]
```

## Rules
- **Follow-up work** ("this order is paid, issue the tickets", "this event was approved, publish it") is queued and run in the background. It is **retried until it succeeds**, so every such step is written to be safe to repeat.
- **Recurring jobs** run at most once per interval, even across restarts or several servers. A failed run is retried after 1, 2, 4 … minutes.
- Platform admins see failing jobs and messages under Notifications in the admin area, with "Run now" / "Retry now".
- Recurring jobs of a switched-off module don't run; follow-up work for payments and reviews still does ([[application-structure]]).
- Emails are covered in [[notifications]].

## Decisions
- Queue and retry instead of doing the work during the request: a crash or a slow service never loses a paid order or a decision.
