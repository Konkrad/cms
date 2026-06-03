# Event CTA Flow

This document captures the CTA decision logic for the event detail page, including both free and paid ticket branches.

## Event Participation Flow

```mermaid
flowchart TD
  A[Event Page Loaded] --> B{Event is past?}
  B -->|Yes| Z[No main CTA]
  B -->|No| C{User logged in?}

  C -->|No| C1[Show: Log In to RSVP]
  C -->|Yes| D{Event has products?}

  D -->|No| D1{Future + not sold out?}
  D1 -->|Yes| W1[Show: Join Waitlist]
  D1 -->|No| N1[No CTA: waitlist unavailable]

  D -->|Yes| E{free event?}

  E -->|No| P1{Ticket sales open + inventory remains?}
  P1 -->|Yes| P2[Show: Buy Your Tickets]
  P1 -->|No| P3{Sales closed?}
  P3 -->|Yes| P4[Show: Sales Closed]
  P3 -->|No| P5{Sold out?}
  P5 -->|Yes| P6[Show: Sold Out]
  P5 -->|No| P7{Future + waitlist open?}
  P7 -->|Yes| P8[Show: Join Waitlist]
  P7 -->|No| P9[No CTA: no ticket action available]

  E -->|Yes| F3[Show: Participation Toggle]

  F3 --> T1{Status selected}
  T1 -->|Yes| T2["Ensure one free ticket exists<br>Increment soldQuantity if created"]
  T1 -->|Maybe| T3["Ensure one free ticket exists<br>Increment soldQuantity if created"]
  T1 -->|No| T4["Delete unscanned free ticket(s) only<br>Decrement soldQuantity<br>(only when switching from yes/maybe)"]

  classDef paid fill:#fff3e0,stroke:#ef6c00,color:#5d4037;
  classDef free fill:#e8f5e9,stroke:#2e7d32,color:#1b5e20;
  classDef neutral fill:#eceff1,stroke:#546e7a,color:#263238;

  class P1,P2,P3,P4,P5,P6,P7,P8,P9 paid;
  class F3,T1,T2,T3,T4 free;
  class A,B,C,D,D1,W1,N1,Z,C1 neutral;
```

## Notes

- Paid tickets are never removed by RSVP status changes.
- Free RSVP removal path only deletes tickets tied to free transactions (`free_*`) and only if unscanned.
- Capacity is represented via `soldQuantity` and is adjusted in this free RSVP lifecycle.

## Ticket buying flow

This flow starts after pressing `Buy Your Tickets` and covers the paid checkout route end-to-end.

```mermaid
flowchart TD
  A[Press: Buy Your Tickets] --> B[Open checkout page]
  B --> C[Load inventory groups and products]
  C --> D{Group sales open and group capacity > 0?}
  D -->|No| D1[Group not selectable: Sold Out / Sales Closed / Not Yet Open]
  D -->|Yes| E{Product quantity available?}
  E -->|No| E1[Product hidden from selectable list]
  E -->|Yes| F[Select one product per inventory group]
  F --> G[Proceed to consent and payment step]

  G --> H{Food preference already saved?}
  H -->|No| H1[Choose dietary preference]
  H -->|Yes| I{Photo consent already saved?}
  H1 --> I

  I -->|No| I1[Choose photo consent]
  I -->|Yes| L[Create Stripe PaymentIntent]
  I1 --> L

  L --> M[Confirm payment in Stripe]
  M --> N[Stripe webhook receives payment_intent.succeeded]
  N --> O[Create tickets for purchased products]
  O --> P[Increment soldQuantity for purchased products]
  P --> Q[Auto-upgrade participation maybe → yes if tickets were created]
  Q --> R[Send confirmation email and ticket QR codes]
  R --> S[Show Payment Successful and View My Tickets]

  classDef step fill:#e3f2fd,stroke:#1565c0,color:#0d47a1;
  class A,B,C,D,D1,E,E1,F,G,H,H1,I,I1,L,M,N,O,P,Q,R,S step;
```

## Notes on Purchase Flow

- Availability is filtered twice: first by inventory group (sales window + group capacity), then by product quantity.
- Checkout currently allows one selected product per inventory group.
- Food preference and photo consent are shown only when the user has not already answered them.
- Checkout validates inventory again on submit before creating a payment intent.
- The Stripe webhook is what finalizes paid ticket creation.
- Confirmation email sending happens after ticket creation and should not fail the purchase if email delivery fails.
