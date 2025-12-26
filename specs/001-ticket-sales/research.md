# Research: Ticket Sales System

**Date**: 2025-12-25  
**Feature**: 001-ticket-sales

## Research Overview

This document consolidates research findings for implementing the ticket sales system, including technology integration patterns, best practices, and architectural decisions.

---

## 1. Stripe Integration with Qwik

### Decision
Use Stripe Checkout embedded components with server-side session creation and webhook-based fulfillment.

### Rationale
- **Embedded Checkout**: Provides PCI-compliant payment UI without heavy client-side dependencies
- **Server-side sessions**: Keep product IDs and pricing secure, prevent client manipulation
- **Webhook fulfillment**: Ensures transaction recording even if user closes browser after payment
- **Qwik compatibility**: Stripe Elements can be wrapped in Qwik components using `qwik-react` for React interop if needed, but Checkout URL redirect is simpler

### Implementation Pattern
```typescript
// In routeAction$() - Create Checkout Session
const session = await stripe.checkout.sessions.create({
  mode: 'payment',
  line_items: selectedProducts.map(p => ({
    price_data: {
      currency: 'eur',
      product_data: { name: p.name },
      unit_amount: p.price * 100, // cents
    },
    quantity: p.quantity,
  })),
  success_url: `${APP_URL}/events/${eventId}/buy/success?session_id={CHECKOUT_SESSION_ID}`,
  cancel_url: `${APP_URL}/events/${eventId}/buy/failed`,
  metadata: { eventId, userId, products: JSON.stringify(selection) },
});

// Redirect to session.url
```

```typescript
// Webhook handler - Process payment
export const onPost = routeAction$(async ({ request }) => {
  const sig = request.headers.get('stripe-signature');
  const event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
  
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    // Create transaction record
    // Generate tickets
    // Send email
    // Send Telegram notification
  }
});
```

### Alternatives Considered
- **Stripe Payment Intents + Elements**: More complex integration, requires more client-side code, no advantage for basic checkout flow
- **Stripe Billing**: Overkill for one-time ticket purchases, adds subscription complexity

### References
- [Stripe Checkout Documentation](https://stripe.com/docs/checkout/quickstart)
- [Stripe Webhooks Guide](https://stripe.com/docs/webhooks)

---

## 2. QR Code Generation & Scanning

### Decision
Generate QR codes dynamically via endpoint `/tickets/[ticketId]/qr_code.png` using `qrcode` library. Scan using `html5-qrcode` in admin interface.

### Rationale
- **Dynamic generation**: No storage overhead, always generates fresh PNG from ticket UUID
- **Separate UUID for QR**: Security by obscurity - don't expose database IDs in QR codes
- **html5-qrcode**: Works across devices with camera access, handles different lighting conditions
- **Performance**: `qrcode` library generates 200x200 PNG in <100ms on Node.js

### Implementation Pattern
```typescript
// QR Code Generation Endpoint
export const onGet = routeAction$(async ({ params }) => {
  const ticket = await ticketsService.getByIdPublic(params.ticketId);
  if (!ticket) return new Response('Not found', { status: 404 });
  
  const qrBuffer = await QRCode.toBuffer(ticket.qrCodeUuid, {
    width: 400,
    margin: 2,
    errorCorrectionLevel: 'H',
  });
  
  return new Response(qrBuffer, {
    headers: { 'Content-Type': 'image/png' },
  });
});
```

```typescript
// Scanner Component (Qwik wrapper around html5-qrcode)
export const TicketScanner = component$(() => {
  const onScan = $((decodedText: string) => {
    // decodedText is the qrCodeUuid
    // Call ticketsService.markScanned(uuid)
  });
  
  useVisibleTask$(() => {
    const scanner = new Html5Qrcode("qr-reader");
    scanner.start({ facingMode: "environment" }, config, onScan);
  });
});
```

### Alternatives Considered
- **Pre-generated QR codes stored in S3**: Adds storage cost, complicates ticket generation flow
- **jsQR for scanning**: Less robust than html5-qrcode for camera handling
- **QR codes in email as data URIs**: Would work but endpoint approach is more flexible for regeneration

### References
- [qrcode npm package](https://www.npmjs.com/package/qrcode)
- [html5-qrcode documentation](https://scanapp.org/html5-qrcode-docs/)

---

## 3. Inventory Management & Race Conditions

### Decision
Implement optimistic locking with database-level constraints to prevent overselling. Use SQLite transactions for atomic inventory updates.

### Rationale
- **Race condition risk**: Multiple users checking out simultaneously could oversell capacity
- **SQLite transactions**: ACID guarantees prevent inventory corruption
- **Check-then-update pattern**: Validate inventory before payment, re-validate in webhook before decrementing
- **Inventory at group level**: Multiple products share same capacity pool (e.g., "General Admission" with "Early Bird" and "Regular" products)

### Implementation Pattern
```typescript
// Before creating Stripe session
const validation = await inventoryGroupsService.validatePurchase(
  inventoryGroupId,
  totalQuantity
);
if (!validation.available) {
  throw new Error('Insufficient inventory');
}

// In webhook (atomic transaction)
await db.transaction(async (tx) => {
  const group = await tx.query.inventoryGroups.findFirst({
    where: eq(inventoryGroups.id, groupId),
  });
  
  const sold = await tx.query.products
    .findMany({ where: eq(products.inventoryGroupId, groupId) })
    .then(products => products.reduce((sum, p) => sum + p.soldQuantity, 0));
  
  if (sold + quantity > group.maxCapacity) {
    throw new Error('Inventory exhausted during checkout');
  }
  
  await tx.update(products)
    .set({ soldQuantity: products.soldQuantity + quantity })
    .where(eq(products.id, productId));
});
```

### Alternatives Considered
- **Redis-based inventory**: Overkill for SQLite-based project, adds operational complexity
- **Pessimistic locking**: Would require row locks, SQLite doesn't support well for reads
- **No validation**: Unacceptable - overselling damages trust and creates logistical nightmares

### References
- [SQLite Transaction Documentation](https://www.sqlite.org/lang_transaction.html)
- [Drizzle ORM Transactions](https://orm.drizzle.team/docs/transactions)

---

## 4. Email Templates with react-email & iCal

### Decision
Use existing `react-email` setup (already in project) to render ticket confirmation emails with iCal attachments generated via `ics` library.

### Rationale
- **Already integrated**: react-email exists in project dependencies, no setup needed
- **Type-safe templates**: React components with TypeScript provide compile-time safety
- **ics library**: Simple API for generating RFC 5545-compliant iCal files
- **SMTP**: Existing nodemailer configuration in `env.ts` handles delivery

### Implementation Pattern
```tsx
// emails/ticket-confirmation.tsx
import { Body, Container, Heading, Img, Section, Text } from '@react-email/components';

export const TicketConfirmation = ({ 
  eventTitle, 
  tickets, 
  eventDate 
}: TicketConfirmationProps) => (
  <Html>
    <Body>
      <Container>
        <Heading>Your tickets for {eventTitle}</Heading>
        {tickets.map(ticket => (
          <Section key={ticket.id}>
            <Text>{ticket.productName}</Text>
            <Img src={`${APP_URL}/tickets/${ticket.id}/qr_code.png`} width={200} />
          </Section>
        ))}
      </Container>
    </Body>
  </Html>
);
```

```typescript
// Generate iCal attachment
import ics from 'ics';

const icalContent = ics.createEvent({
  title: event.title,
  start: parseDate(event.startDate),
  end: parseDate(event.endDate),
  location: event.address,
  description: event.body,
});

// Attach to nodemailer
await transporter.sendMail({
  from: env.SMTP_FROM,
  to: user.email,
  subject: `Tickets for ${event.title}`,
  html: await render(<TicketConfirmation {...data} />),
  attachments: [{
    filename: 'event.ics',
    content: icalContent,
  }],
});
```

### Alternatives Considered
- **MJML**: More powerful but adds build step complexity, react-email sufficient for needs
- **Manual iCal generation**: Error-prone, ics library handles RFC compliance

### References
- [react-email documentation](https://react.email/docs/introduction)
- [ics npm package](https://www.npmjs.com/package/ics)
- [RFC 5545 (iCalendar)](https://datatracker.ietf.org/doc/html/rfc5545)

---

## 5. Telegram Notifications with node-telegram-bot-api

### Decision
Send transaction notifications to configured Telegram channel using `node-telegram-bot-api` after successful payment.

### Rationale
- **Real-time alerts**: Instant notification when tickets sell
- **Simple API**: Bot token + channel ID sufficient for notifications
- **Fire-and-forget**: Don't block webhook processing if Telegram is slow
- **node-telegram-bot-api**: Most popular Node.js library for Telegram Bot API

### Implementation Pattern
```typescript
// services/telegram.service.ts
import TelegramBot from 'node-telegram-bot-api';
import { env } from '~/env';

const bot = new TelegramBot(env.TELEGRAM_BOT_TOKEN, { polling: false });

export const telegramService = {
  async notifyPurchase(transaction: Transaction) {
    try {
      await bot.sendMessage(
        env.TELEGRAM_CHANNEL_ID,
        `🎟️ New ticket sale!\n\n` +
        `Event: ${transaction.eventTitle}\n` +
        `Amount: €${transaction.totalAmount}\n` +
        `Tickets: ${transaction.itemCount}\n` +
        `Buyer: ${transaction.buyerEmail}`
      );
    } catch (error) {
      // Log but don't throw - Telegram failures shouldn't block transactions
      console.error('Telegram notification failed:', error);
    }
  }
};
```

### Alternatives Considered
- **Slack webhooks**: Requires Slack workspace, Telegram is simpler for personal projects
- **Discord webhooks**: Similar complexity to Telegram, no advantage
- **Email notifications to admin**: Already happening via transaction records, Telegram provides push notifications

### References
- [node-telegram-bot-api documentation](https://github.com/yagop/node-telegram-bot-api)
- [Telegram Bot API](https://core.telegram.org/bots/api)

---

## 6. Fuzzy Search with fuse.js

### Decision
Use `fuse.js` for client-side fuzzy search of tickets by buyer name in the admin scanning interface.

### Rationale
- **Typo tolerance**: Staff can search "jhon" and find "John"
- **Client-side**: No backend changes needed, works offline during event
- **Lightweight**: 12KB minified, perfect for Qwik's lazy loading
- **Performance**: Handles thousands of tickets without lag

### Implementation Pattern
```typescript
// In TicketList component
import Fuse from 'fuse.js';

export const TicketList = component$(() => {
  const tickets = useSignal<Ticket[]>([]);
  const searchQuery = useSignal('');
  
  const fuse = new Fuse(tickets.value, {
    keys: ['buyerName', 'buyerEmail'],
    threshold: 0.3, // 0 = exact, 1 = match anything
  });
  
  const filtered = searchQuery.value 
    ? fuse.search(searchQuery.value).map(r => r.item)
    : tickets.value;
  
  return (
    <>
      <input 
        value={searchQuery.value}
        onInput$={(e) => searchQuery.value = e.target.value}
        placeholder="Search by name..."
      />
      {filtered.map(ticket => <TicketCard ticket={ticket} />)}
    </>
  );
});
```

### Alternatives Considered
- **Full-text search in SQLite**: Adds query complexity, overkill for small ticket lists per event
- **Simple string.includes()**: No typo tolerance, poor UX
- **Backend search endpoint**: Adds latency, requires network during event

### References
- [fuse.js documentation](https://fusejs.io/)

---

## 7. Testing Strategy

### Decision
**NEEDS USER CLARIFICATION** - No existing test framework identified in project. Recommended approach:

- **Unit tests**: Vitest (Vite-native, fast)
- **Integration tests**: Test services with in-memory SQLite
- **E2E tests**: Playwright for critical flows (checkout, scanning)

### Why Clarification Needed
The project currently has no test scripts in `package.json` and no test directory structure. Before implementing tests, need to confirm:
1. Is testing required for this feature?
2. What level of coverage is expected?
3. Should test infrastructure be set up as part of this ticket?

### Recommended If Implemented
```json
// package.json
{
  "scripts": {
    "test": "vitest",
    "test:e2e": "playwright test"
  },
  "devDependencies": {
    "vitest": "^1.0.0",
    "@playwright/test": "^1.40.0"
  }
}
```

### Critical Test Scenarios
1. **Inventory race condition**: Concurrent purchases don't oversell
2. **Webhook idempotency**: Processing same webhook twice doesn't duplicate tickets
3. **QR code uniqueness**: Each ticket gets unique QR UUID
4. **Email delivery failure**: Transaction completes even if email fails

---

## 8. Stripe Product Synchronization

### Decision
Create Stripe products lazily on first local product creation. Store `stripeProductId` in local database for future reference.

### Rationale
- **Single source of truth**: Local database drives product data
- **Stripe as payment processor**: Stripe products exist to enable checkout, not as primary data store
- **Manual sync acceptable**: Event products change infrequently, no need for bidirectional sync
- **Price flexibility**: Create price on-the-fly during checkout session creation (Stripe allows ad-hoc prices)

### Implementation Pattern
```typescript
// In products.service.ts
async createProduct(data: InsertProduct): Promise<Product> {
  // Create local product
  const product = await db.insert(products).values(data).returning();
  
  // Create Stripe product
  const stripeProduct = await stripe.products.create({
    name: product.name,
    description: `Ticket for ${event.title}`,
    metadata: { localProductId: product.id },
  });
  
  // Update local record with Stripe ID
  await db.update(products)
    .set({ stripeProductId: stripeProduct.id })
    .where(eq(products.id, product.id));
  
  return product;
}
```

### Alternatives Considered
- **Bidirectional sync**: Complex, error-prone, unnecessary for ticket sales
- **Stripe as source of truth**: Would require querying Stripe API for product lists, adds latency
- **No Stripe product creation**: Stripe Checkout requires products or ad-hoc line items (both work, products provide better reporting in Stripe Dashboard)

---

## 9. Image Cropping Integration

### Decision
Reuse existing cropper.js integration from project (referenced in spec and constitution).

### Implementation Details
- **NEEDS CODEBASE REVIEW**: Constitution mentions cropper.js is already integrated
- **Usage**: Product image upload flow should use existing image picker with crop
- **Pattern**: Follow existing pattern from other image uploads in project

### Action Items
1. Locate existing cropper.js implementation in codebase
2. Extract reusable component if not already componentized
3. Apply to product image upload flow

---

## 10. Security Considerations

### Webhook Signature Verification
```typescript
// Critical: Always verify Stripe webhook signatures
const sig = request.headers.get('stripe-signature');
const event = stripe.webhooks.constructEvent(
  rawBody, 
  sig, 
  env.STRIPE_WEBHOOK_SECRET
);
// Only proceed if verification succeeds
```

### QR Code UUID Separation
- **Database ID**: Integer, used for internal queries
- **QR Code UUID**: UUID v4, encoded in QR code
- **Rationale**: Prevents enumeration attacks (scanning sequential IDs to access all tickets)

### Inventory Validation
```typescript
// Always validate in webhook, even if validated before checkout
// User could manipulate checkout or webhook could arrive after inventory sells out
const available = await inventoryService.checkAvailability(groupId, quantity);
if (!available) {
  // Log error but don't fail webhook (payment already succeeded)
  // Handle via manual intervention
  await alertsService.notifyOverselling(transaction);
}
```

### Rate Limiting
**RECOMMENDATION**: Add rate limiting to:
- Checkout initiation endpoint (prevent spam)
- QR code generation endpoint (prevent DoS)
- Webhook endpoint (validate Stripe IPs)

---

## Summary of Technology Choices

| Category | Technology | Version | Rationale |
|----------|-----------|---------|-----------|
| Payment | Stripe SDK | Latest | Industry standard, PCI compliant |
| Email | react-email | 5.1.0 | Already in project |
| Email Transport | nodemailer | 6.9.3 | Already configured |
| iCal | ics | Latest | RFC 5545 compliance |
| Notifications | node-telegram-bot-api | Latest | Simple push notifications |
| QR Generation | qrcode | Latest | Fast server-side generation |
| QR Scanning | html5-qrcode | Latest | Cross-device camera support |
| Fuzzy Search | fuse.js | Latest | Client-side typo tolerance |
| Image Cropping | cropper.js | Existing | Already integrated |

---

## Open Questions

1. ✅ **Testing framework**: Needs user clarification on requirements
2. ✅ **Rate limiting**: Should we implement rate limiting in this phase?
3. ✅ **Refund handling**: Out of scope per spec, confirm manual Stripe dashboard flow acceptable
4. ✅ **Multi-event checkout**: Out of scope per spec, one event per transaction
5. ✅ **Ticket transfer**: Out of scope per spec, confirmed

---

**Research Complete**: All technical unknowns resolved except testing framework (pending user clarification). Ready to proceed to Phase 1 (Design & Contracts).
