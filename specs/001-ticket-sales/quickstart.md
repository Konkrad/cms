# Quickstart Guide: Ticket Sales System

**Date**: 2025-12-25  
**Feature**: 001-ticket-sales

## Overview

This quickstart guide provides step-by-step instructions for implementing the ticket sales system. Follow phases in order, as each phase builds on the previous.

---

## Prerequisites

### Environment Setup

Add to `.env`:
```bash
# Stripe Configuration
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Telegram Notifications
TELEGRAM_BOT_TOKEN=123456:ABC-DEF...
TELEGRAM_CHANNEL_ID=-1001234567890

# Existing variables (already configured)
# SMTP_*, APP_URL, AWS_*, etc.
```

Update `src/env.ts`:
```typescript
const envSchema = z.object({
  // ... existing fields ...
  
  // Stripe
  STRIPE_SECRET_KEY: z.string(),
  STRIPE_PUBLISHABLE_KEY: z.string(),
  STRIPE_WEBHOOK_SECRET: z.string(),
  
  // Telegram
  TELEGRAM_BOT_TOKEN: z.string(),
  TELEGRAM_CHANNEL_ID: z.string(),
});

export const env = {
  // ... existing exports ...
  STRIPE_SECRET_KEY: _env.STRIPE_SECRET_KEY,
  STRIPE_PUBLISHABLE_KEY: _env.STRIPE_PUBLISHABLE_KEY,
  STRIPE_WEBHOOK_SECRET: _env.STRIPE_WEBHOOK_SECRET,
  TELEGRAM_BOT_TOKEN: _env.TELEGRAM_BOT_TOKEN,
  TELEGRAM_CHANNEL_ID: _env.TELEGRAM_CHANNEL_ID,
} as const;
```

### Install Dependencies

```bash
npm install stripe node-telegram-bot-api qrcode ics fuse.js html5-qrcode
npm install --save-dev @types/node-telegram-bot-api @types/qrcode
```

---

## Phase 1: Database Schema

### Step 1: Create Schema Files

Create the following files in `src/db/schemas/`:
- `inventory-groups.ts`
- `products.ts`
- `transactions.ts`
- `transaction-items.ts`
- `tickets.ts`

Copy implementations from `data-model.md`.

### Step 2: Update Schema Aggregator

Update `src/db/schema.ts`:
```typescript
export * from "./schemas/events";
export * from "./schemas/users";
// ... existing exports ...

// NEW: Ticket sales schemas
export * from "./schemas/inventory-groups";
export * from "./schemas/products";
export * from "./schemas/transactions";
export * from "./schemas/transaction-items";
export * from "./schemas/tickets";
```

### Step 3: Extend Events Schema

Update `src/db/schemas/events.ts`:
```typescript
import { inventoryGroups } from "./inventory-groups";
import { products } from "./products";
import { transactions } from "./transactions";
import { tickets } from "./tickets";

export const eventsRelations = relations(events, ({ one, many }) => ({
  user: one(users, {
    fields: [events.userId],
    references: [users.id],
  }),
  // NEW relations
  inventoryGroups: many(inventoryGroups),
  products: many(products),
  transactions: many(transactions),
  tickets: many(tickets),
}));
```

### Step 4: Generate and Apply Migration

```bash
npm run db:generate
npm run db:migrate
```

---

## Phase 2: Service Layer

### Step 1: Utility Services

Create foundational services first:

#### `src/services/stripe.service.ts`
```typescript
import Stripe from 'stripe';
import { env } from '~/env';

const stripe = new Stripe(env.STRIPE_SECRET_KEY, {
  apiVersion: '2024-12-18.acacia',
});

export const stripeService = {
  stripe, // Export instance for direct access
  
  async createProduct(name: string, description: string) {
    return stripe.products.create({
      name,
      description,
    });
  },
  
  async createCheckoutSession(params: {
    lineItems: Array<{
      price_data: {
        currency: string;
        product_data: { name: string };
        unit_amount: number;
      };
      quantity: number;
    }>;
    successUrl: string;
    cancelUrl: string;
    metadata: Record<string, string>;
  }) {
    return stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: params.lineItems,
      success_url: params.successUrl,
      cancel_url: params.cancelUrl,
      metadata: params.metadata,
    });
  },
};
```

#### `src/services/qrcode.service.ts`
```typescript
import QRCode from 'qrcode';

export const qrcodeService = {
  async generatePNG(data: string): Promise<Buffer> {
    return QRCode.toBuffer(data, {
      width: 400,
      margin: 2,
      errorCorrectionLevel: 'H',
    });
  },
};
```

#### `src/services/telegram.service.ts`
```typescript
import TelegramBot from 'node-telegram-bot-api';
import { env } from '~/env';

const bot = new TelegramBot(env.TELEGRAM_BOT_TOKEN, { polling: false });

export const telegramService = {
  async notifyProductPurchase(params: {
    productName: string;
    quantity: number;
    amount: number;
    remainingInventory: number;
  }) {
    try {
      const message = 
        `📦 Product: ${params.productName} (x${params.quantity})\n` +
        `💰 Amount: €${params.amount.toFixed(2)}\n` +
        `📊 Remaining inventory: ${params.remainingInventory}`;
      
      await bot.sendMessage(env.TELEGRAM_CHANNEL_ID, message);
    } catch (error) {
      console.error('Telegram notification failed:', error);
    }
  },
};
```

#### `src/services/ical.service.ts`
```typescript
import ics from 'ics';
import type { Event } from '~/db/schemas/events';

export const icalService = {
  generateEventIcs(event: Event): string {
    const start = new Date(event.startDate);
    const end = new Date(event.endDate);
    
    const { error, value } = ics.createEvent({
      title: event.title,
      start: [start.getFullYear(), start.getMonth() + 1, start.getDate(), 
              start.getHours(), start.getMinutes()],
      end: [end.getFullYear(), end.getMonth() + 1, end.getDate(), 
            end.getHours(), end.getMinutes()],
      location: event.address || event.onlineUrl || '',
      description: event.body,
    });
    
    if (error) throw error;
    return value!;
  },
};
```

### Step 2: Domain Services

Create business logic services:

#### `src/services/inventory-groups.service.ts`
```typescript
import { eq, sql } from "drizzle-orm";
import { db } from "~/db/connection";
import { 
  inventoryGroups, 
  insertInventoryGroupSchema,
  updateInventoryGroupSchema,
  type InventoryGroup,
  type InsertInventoryGroup,
  type UpdateInventoryGroup,
} from "~/db/schemas/inventory-groups";
import { products } from "~/db/schemas/products";

export const inventoryGroupsService = {
  async getByEventId(eventId: string): Promise<InventoryGroup[]> {
    return db.query.inventoryGroups.findMany({
      where: eq(inventoryGroups.eventId, eventId),
      with: { products: true },
    });
  },
  
  async create(data: InsertInventoryGroup): Promise<InventoryGroup> {
    const parsed = insertInventoryGroupSchema.parse(data);
    const [result] = await db
      .insert(inventoryGroups)
      .values(parsed as any)
      .returning();
    return result;
  },
  
  async update(id: string, data: UpdateInventoryGroup): Promise<InventoryGroup> {
    const parsed = updateInventoryGroupSchema.parse(data);
    const [result] = await db
      .update(inventoryGroups)
      .set(parsed as any)
      .where(eq(inventoryGroups.id, id))
      .returning();
    return result;
  },
  
  async validatePurchase(
    inventoryGroupId: string, 
    additionalQuantity: number
  ): Promise<{ available: boolean; remaining: number }> {
    const group = await db.query.inventoryGroups.findFirst({
      where: eq(inventoryGroups.id, inventoryGroupId),
      with: { products: true },
    });
    
    if (!group) throw new Error('Inventory group not found');
    
    const soldQuantity = group.products.reduce(
      (sum, p) => sum + (p.soldQuantity || 0), 
      0
    );
    const remaining = group.maxCapacity - soldQuantity;
    
    return {
      available: remaining >= additionalQuantity,
      remaining,
    };
  },
};
```

#### `src/services/products.service.ts`
```typescript
import { eq } from "drizzle-orm";
import { db } from "~/db/connection";
import { 
  products, 
  insertProductSchema,
  updateProductSchema,
  type Product,
  type InsertProduct,
  type UpdateProduct,
} from "~/db/schemas/products";
import { stripeService } from "./stripe.service";

export const productsService = {
  async getByEventId(eventId: string): Promise<Product[]> {
    return db.query.products.findMany({
      where: eq(products.eventId, eventId),
      with: { inventoryGroup: true },
    });
  },
  
  async create(data: InsertProduct): Promise<Product> {
    const parsed = insertProductSchema.parse(data);
    
    // Create local product first
    const [product] = await db
      .insert(products)
      .values(parsed as any)
      .returning();
    
    // Create Stripe product
    const stripeProduct = await stripeService.createProduct(
      product.name,
      `Ticket for event ${product.eventId}`
    );
    
    // Update with Stripe ID
    const [updated] = await db
      .update(products)
      .set({ stripeProductId: stripeProduct.id })
      .where(eq(products.id, product.id))
      .returning();
    
    return updated;
  },
  
  async update(id: string, data: UpdateProduct): Promise<Product> {
    const parsed = updateProductSchema.parse(data);
    const [result] = await db
      .update(products)
      .set(parsed as any)
      .where(eq(products.id, id))
      .returning();
    return result;
  },
  
  async incrementSold(id: string, quantity: number): Promise<void> {
    await db
      .update(products)
      .set({ soldQuantity: sql`${products.soldQuantity} + ${quantity}` })
      .where(eq(products.id, id));
  },
};
```

Continue pattern for:
- `transactions.service.ts`
- `tickets.service.ts`

---

## Phase 3: Webhook Handler

### `src/routes/api/webhooks/stripe/index.ts`

```typescript
import type { RequestHandler } from '@builder.io/qwik-city';
import { stripeService } from '~/services/stripe.service';
import { transactionsService } from '~/services/transactions.service';
import { ticketsService } from '~/services/tickets.service';
import { emailService } from '~/services/email.service';
import { telegramService } from '~/services/telegram.service';
import { env } from '~/env';

export const onPost: RequestHandler = async ({ request, json }) => {
  const sig = request.headers.get('stripe-signature');
  const rawBody = await request.text();
  
  if (!sig) {
    json(400, { error: 'Missing signature' });
    return;
  }
  
  let event;
  try {
    event = stripeService.stripe.webhooks.constructEvent(
      rawBody,
      sig,
      env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error('Webhook signature verification failed:', err);
    json(400, { error: 'Invalid signature' });
    return;
  }
  
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    
    // Process transaction (includes idempotency check)
    await transactionsService.processCheckout(session);
  }
  
  json(200, { received: true });
};
```

**Note**: Webhook processes payment and updates transaction status table. Frontend polls for status updates.

---

## Phase 4: Admin Interface

### Route Structure

Admin routes follow pattern: `/src/routes/admin/events/[id]/`

- `details/` - Event details tab
- `products/` - Products management tab
- `transactions/` - Transaction history tab  
- `tickets/` - Tickets list and scanning tab
- `tickets/[ticket-id]/qr-code.png` - QR code image generation

### Tab Layout: `/src/routes/admin/events/[id]/layout.tsx`

```typescript
import { component$, Slot } from '@builder.io/qwik';
import { Link, useLocation } from '@builder.io/qwik-city';

export default component$(() => {
  const loc = useLocation();
  const eventId = loc.params.id;
  
  const tabs = [
    { path: 'details', label: 'Details' },
    { path: 'products', label: 'Products' },
    { path: 'transactions', label: 'Transactions' },
    { path: 'tickets', label: 'Tickets' },
  ];
  
  return (
    <div>
      <nav class="border-b mb-4">
        {tabs.map(tab => (
          <Link
            key={tab.path}
            href={`/admin/events/${eventId}/${tab.path}/`}
            class={loc.url.pathname.includes(tab.path) ? 'active' : ''}
          >
            {tab.label}
          </Link>
        ))}
      </nav>
      <Slot />
    </div>
  );
});
```

### QR Code Image Generation: `/src/routes/admin/events/[id]/tickets/[ticket-id]/qr-code.png/index.ts`

```typescript
import type { RequestHandler } from '@builder.io/qwik-city';
import { ticketsService } from '~/services/tickets.service';
import { qrcodeService } from '~/services/qrcode.service';

export const onGet: RequestHandler = async ({ params, send, status, headers }) => {
  const ticketId = params['ticket-id'];
  
  const ticket = await ticketsService.getById(ticketId);
  if (!ticket) {
    status(404);
    send('Ticket not found');
    return;
  }
  
  // Generate QR code from qrCodeUuid
  const qrBuffer = await qrcodeService.generatePNG(ticket.qrCodeUuid);
  
  // Set infinite cache headers
  headers.set('Content-Type', 'image/png');
  headers.set('Cache-Control', 'public, max-age=31536000, immutable');
  headers.set('ETag', ticketId);
  
  send(qrBuffer);
};
```

### Ticket Scanner: `/src/routes/admin/events/[id]/tickets/index.tsx`

```typescript
import { component$, useSignal, useVisibleTask$ } from '@builder.io/qwik';
import { routeLoader$, routeAction$, zod$, z } from '@builder.io/qwik-city';
import { Html5QrcodeScanner } from 'html5-qrcode';

export const useScanTicket = routeAction$(
  async ({ qrCodeUuid }, { params }) => {
    const result = await ticketsService.scanTicket(params.id, qrCodeUuid);
    return result;
  },
  zod$({ qrCodeUuid: z.string().uuid() })
);

export default component$(() => {
  const scanAction = useScanTicket();
  const scanResult = useSignal<'success' | 'failure' | null>(null);
  const isPaused = useSignal(false);
  
  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(({ cleanup }) => {
    const scanner = new Html5QrcodeScanner(
      'qr-reader',
      { 
        fps: 3,
        qrbox: { width: 250, height: 250 },
      },
      false
    );
    
    scanner.render(
      async (decodedText) => {
        // Pause scanner
        scanner.pause();
        isPaused.value = true;
        
        // Submit scan
        const result = await scanAction.submit({ qrCodeUuid: decodedText });
        
        if (result.value.success) {
          // Success feedback
          scanResult.value = 'success';
          if (navigator.vibrate) {
            navigator.vibrate([100, 100]); // Two short vibrations
          }
          
          // Display success for 2 seconds, wait for user to continue
          // User must click "Continue" button to resume
        } else {
          // Failure feedback
          scanResult.value = 'failure';
          if (navigator.vibrate) {
            navigator.vibrate([100, 30, 100]); // Pattern for failure
          }
          
          // Auto-resume after 2 seconds on failure
          setTimeout(() => {
            scanner.resume();
            isPaused.value = false;
            scanResult.value = null;
          }, 2000);
        }
      },
      (error) => {
        console.warn('QR scan error:', error);
      }
    );
    
    cleanup(() => scanner.clear());
  });
  
  return (
    <div>
      <div id="qr-reader" style={{ width: '100%' }}></div>
      
      {scanResult.value === 'success' && (
        <div class="success-overlay">
          <h2>✓ Ticket Valid</h2>
          <p>{scanAction.value?.data?.productName}</p>
          <p>{scanAction.value?.data?.buyerName}</p>
          <button 
            onClick$={() => {
              // Resume scanner
              isPaused.value = false;
              scanResult.value = null;
              // Scanner resume happens in next render
            }}
          >
            Continue Scanning
          </button>
        </div>
      )}
      
      {scanResult.value === 'failure' && (
        <div class="failure-overlay">
          <h2>✗ Already Scanned</h2>
          <p>Scanned at: {scanAction.value?.data?.previousScanAt}</p>
        </div>
      )}
    </div>
  );
});
```

Implement child routes:
- `details/index.tsx` - Existing event form
- `products/index.tsx` - Product management (inventory groups + products)
- `transactions/index.tsx` - Transaction list with details
- `tickets/index.tsx` - Ticket scanning interface (shown above)

---

## Phase 5: Public Purchase Flow

### Route Structure

User purchase routes: `/src/routes/events/[id]/`

- `products/` - Product selection page
- `checkout/` - Payment page (Stripe embedded, handles success/failure on same page)

### Product Selection: `/src/routes/events/[id]/products/index.tsx`

```typescript
import { component$ } from '@builder.io/qwik';
import { routeLoader$, routeAction$, zod$, z, Form } from '@builder.io/qwik-city';
import { productsService } from '~/services/products.service';
import { inventoryGroupsService } from '~/services/inventory-groups.service';

export const useProducts = routeLoader$(async ({ params }) => {
  const groups = await inventoryGroupsService.getByEventId(params.id);
  return groups;
});

export const useInitiateCheckout = routeAction$(
  async ({ selections }, { params, redirect }) => {
    // Validate: one product per inventory group
    const groupIds = new Set(
      selections.map(s => s.inventoryGroupId)
    );
    if (groupIds.size !== selections.length) {
      return { 
        success: false, 
        error: 'Only one product per ticket type allowed' 
      };
    }
    
    // Validate inventory and create Stripe session
    const session = await checkoutService.createSession({
      eventId: params.id,
      selections,
    });
    
    throw redirect(303, `/events/${params.id}/checkout?session=${session.id}`);
  },
  zod$({
    selections: z.array(
      z.object({
        productId: z.string().uuid(),
        inventoryGroupId: z.string().uuid(),
        quantity: z.number().int().positive(),
      })
    ).min(1),
  })
);

export default component$(() => {
  const inventoryGroups = useProducts();
  const initiateCheckout = useInitiateCheckout();
  
  return (
    <div>
      <h1>Select Tickets</h1>
      <Form action={initiateCheckout}>
        {inventoryGroups.value.map(group => (
          <section key={group.id}>
            <h2>{group.name}</h2>
            <p>Select ONE product from this group:</p>
            {group.products.map(product => (
              <div key={product.id}>
                <label>
                  <input 
                    type="radio" 
                    name={`group-${group.id}`} 
                    value={product.id}
                  />
                  {product.name} - €{product.price}
                </label>
                <input 
                  type="number" 
                  name={`quantity-${product.id}`}
                  min="1"
                  max={product.maxQuantity || 99}
                />
              </div>
            ))}
          </section>
        ))}
        <button type="submit">Continue to Payment</button>
      </Form>
    </div>
  );
});
```

### Checkout Page: `/src/routes/events/[id]/checkout/index.tsx`

```typescript
import { component$, useSignal, useVisibleTask$ } from '@builder.io/qwik';
import { routeLoader$, routeAction$, zod$, z } from '@builder.io/qwik-city';
import { loadStripe } from '@stripe/stripe-js';

export const useCheckSession = routeLoader$(async ({ query, params }) => {
  const sessionId = query.get('session');
  if (!sessionId) {
    throw new Error('Missing session ID');
  }
  
  const session = await stripeService.getSession(sessionId);
  return { session };
});

export const useCheckStatus = routeAction$(
  async ({ sessionId }) => {
    const transaction = await transactionsService.findBySessionId(sessionId);
    if (transaction) {
      return { status: 'completed', transactionId: transaction.id };
    }
    return { status: 'pending' };
  },
  zod$({ sessionId: z.string() })
);

export default component$(() => {
  const { session } = useCheckSession().value;
  const checkStatus = useCheckStatus();
  const paymentStatus = useSignal<'processing' | 'success' | 'failure'>('processing');
  
  // Poll for transaction completion
  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(({ cleanup }) => {
    const interval = setInterval(async () => {
      const result = await checkStatus.submit({ sessionId: session.id });
      
      if (result.value.status === 'completed') {
        paymentStatus.value = 'success';
        clearInterval(interval);
      }
    }, 2000); // Poll every 2 seconds
    
    cleanup(() => clearInterval(interval));
  });
  
  return (
    <div>
      {paymentStatus.value === 'processing' && (
        <div>
          <div id="stripe-checkout"></div>
          <p>Processing payment...</p>
        </div>
      )}
      
      {paymentStatus.value === 'success' && (
        <div class="success">
          <h1>✓ Payment Successful!</h1>
          <p>Check your email for tickets</p>
          <a href="/profile/tickets">View My Tickets</a>
        </div>
      )}
      
      {paymentStatus.value === 'failure' && (
        <div class="failure">
          <h1>✗ Payment Failed</h1>
          <p>Please try again</p>
          <a href={`/events/${session.eventId}/products`}>Back to Products</a>
        </div>
      )}
    </div>
  );
});
```

---

## Phase 6: Email Template

### `/src/emails/ticket-confirmation.tsx`

Following the exact structure with conditional ticket display:

```tsx
import { Text, Section, Heading } from "@react-email/components";
import EmailLayout from "./components/EmailLayout";
import TicketLinksSection from "./components/TicketLinksSection";
import TransactionProductsSummary from "./components/TransactionProductsSummary";

interface EventEmailProps {
  baseUrl: string;
  event: {
    title: string;
    location: string;
    startDate: string;
    endDate: string;
    url: string;
    description: string;
  };
  transaction: {
    buyerName: string;
    products: {
      name: string;
      amount: number;
      quantity: number;
    }[];
  };
  hasTickets: boolean;
  ticketIds: string[];
}

export const TicketConfirmation = ({ 
  baseUrl, 
  event, 
  transaction, 
  hasTickets, 
  ticketIds 
}: EventEmailProps) => (
  <EmailLayout>
    {/* Greeting */}
    <Heading as="h1">Thank you for your purchase!</Heading>
    <Text>Hi {transaction.buyerName},</Text>
    
    {/* Event Details */}
    <Section>
      <Heading as="h2">{event.title}</Heading>
      <Text>
        <strong>When:</strong> {event.startDate} - {event.endDate}<br />
        <strong>Where:</strong> {event.location}<br />
      </Text>
      {event.description && <Text>{event.description}</Text>}
    </Section>
    
    {/* Purchase Summary */}
    <TransactionProductsSummary products={transaction.products} />
    
    {/* Tickets Section - Only if hasTickets is true */}
    {hasTickets && (
      <TicketLinksSection 
        baseUrl={baseUrl}
        ticketIds={ticketIds}
        eventTitle={event.title}
      />
    )}
    
    {/* Footer */}
    <Text>
      {hasTickets 
        ? "See you at the event!" 
        : "Your purchase is confirmed. No tickets required."}
    </Text>
  </EmailLayout>
);
```

**Key Points**:
- Uses existing `EmailLayout`, `TicketLinksSection`, and `TransactionProductsSummary` components
- Only renders `TicketLinksSection` when `hasTickets` is `true`
- Follows the structure: Greeting → Event Details → Purchase Summary → Tickets (conditional) → Footer
- `ticketIds` are used to generate QR code URLs in `TicketLinksSection`

### iCal Attachment

Attach `.ics` file to email using existing `icalService.generateEventIcs()`:

```typescript
// In email sending service
const icsContent = icalService.generateEventIcs(event);
await emailService.send({
  to: buyer.email,
  subject: `Tickets for ${event.title}`,
  html: renderToHtml(<TicketConfirmation {...props} />),
  attachments: [
    {
      filename: 'event.ics',
      content: icsContent,
      contentType: 'text/calendar',
    }
  ],
});
```

---

## Testing Checklist

### Manual Testing

1. **Product Creation**
   - [ ] Create inventory group
   - [ ] Create product with image
   - [ ] Verify Stripe product created
   - [ ] Update product details

2. **Purchase Flow**
   - [ ] Select products
   - [ ] Complete Stripe checkout (test mode)
   - [ ] Verify webhook received
   - [ ] Check transaction recorded
   - [ ] Verify tickets generated
   - [ ] Confirm email received
   - [ ] Check Telegram notification

3. **Ticket Scanning**
   - [ ] Scan QR code
   - [ ] Verify marked as scanned
   - [ ] Try scanning again (should warn)
   - [ ] Search by buyer name

4. **Edge Cases**
   - [ ] Attempt to buy more than maxQuantity
   - [ ] Attempt to exceed inventory capacity
   - [ ] Close browser during checkout (webhook should still process)
   - [ ] Invalid QR code scan

### Stripe Testing

Use Stripe test mode with test card: `4242 4242 4242 4242`

### Webhook Testing

1. Use Stripe CLI for local webhook forwarding:
```bash
stripe listen --forward-to localhost:5173/api/webhooks/stripe
```

2. Trigger test webhook:
```bash
stripe trigger checkout.session.completed
```

---

## Deployment Notes

### Stripe Webhook Setup

1. In Stripe Dashboard → Webhooks
2. Add endpoint: `https://yourdomain.com/api/webhooks/stripe`
3. Select event: `checkout.session.completed`
4. Copy webhook secret to `STRIPE_WEBHOOK_SECRET`

### Environment Variables

Production `.env` requires:
- Stripe live keys (not test keys)
- Real Telegram bot token and channel
- SMTP settings for email delivery

---

## Common Issues

### Webhook Signature Verification Fails
- Ensure raw body is used (not parsed JSON)
- Verify webhook secret matches Stripe dashboard

### QR Codes Not Generating
- Check ticket ID is valid UUID
- Verify qrcode package installed

### Inventory Overselling
- Ensure transaction wrapping in webhook handler
- Re-validate inventory before decrementing

### Email Not Sending
- Check SMTP credentials in env
- Verify email service not blocking

---

## Next Steps After Implementation

1. Add rate limiting to checkout and QR endpoints
2. Implement transaction refund UI (manual Stripe refunds)
3. Add analytics dashboard (sales over time)
4. Export ticket lists to CSV
5. Mobile-optimized ticket scanning interface

---

**Quickstart Complete**: Follow phases sequentially for successful implementation. Refer to `data-model.md` and `api-contracts.md` for detailed specifications.
