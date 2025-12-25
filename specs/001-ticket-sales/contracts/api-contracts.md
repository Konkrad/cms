# API Contracts: Ticket Sales System

**Date**: 2025-12-25  
**Feature**: 001-ticket-sales

## Overview

This document defines the routes and contracts for the ticket sales system. The system uses Qwik City visual routes for UI pages and route loaders/actions for data operations. Only one traditional REST API endpoint exists for webhook handling.

## Architecture Clarification

### Qwik Visual Routes (UI Pages)
These are page routes that render UI components, not REST APIs:
- `/routes/admin/events/[id]/details` - Event details tab
- `/routes/admin/events/[id]/products` - Products management tab  
- `/routes/admin/events/[id]/tickets` - Tickets list and scanning tab
- `/routes/admin/events/[id]/tickets/[ticket-id]/qr-code.png` - QR code image generation
- `/routes/admin/events/[id]/transactions` - Transaction history tab
- `/routes/events/[id]/products` - Product selection page
- `/routes/events/[id]/checkout` - Payment page (handles success and failure)

### Real API Endpoint (REST)
- `/api/webhooks/stripe` - Stripe webhook handler

### Purchase Flow Interaction

**Question for consideration**: How should the webhook interact with the checkout page?

**Option 1: Frontend Polling** (Recommended for simplicity)
- Checkout page polls backend every 2-3 seconds after payment submission
- Backend checks transaction status by Stripe session ID
- Shows success/failure when webhook completes processing
- **Pros**: Simple, works across browser refreshes, no WebSocket infrastructure
- **Cons**: Slight delay (2-3 seconds), multiple requests

**Option 2: Backend Push (WebSocket/SSE)**
- Backend pushes update to frontend when webhook arrives
- Requires WebSocket or Server-Sent Events connection
- **Pros**: Instant feedback, efficient
- **Cons**: More complex, requires infrastructure, doesn't survive page refresh

**Option 3: Redirect (Current spec - not recommended)**
- Stripe redirects to success/failure URLs
- Doesn't guarantee webhook has processed
- **Pros**: Native Stripe behavior
- **Cons**: Race condition, webhook may not complete before redirect

**Current implementation uses Option 1 (polling)** unless specified otherwise.

---

## Route Actions (Mutations)

### 1. Create Inventory Group

**Route**: `/admin/events/[id]/products`  
**Action Name**: `createInventoryGroup`  
**Method**: POST (via routeAction$)

**Input Schema** (Zod):
```typescript
z.object({
  name: z.string().min(1).max(100),
  maxCapacity: z.number().int().positive(),
  needsTicket: z.boolean().default(true),
})
```

**Response**:
```typescript
{
  success: true,
  data: {
    id: string,
    name: string,
    maxCapacity: number,
    needsTicket: boolean,
    eventId: string,
  }
}
```

**Errors**:
- `400`: Invalid input (Zod validation failure)
- `403`: User not authorized to manage event
- `404`: Event not found

---

### 2. Create Product

**Route**: `/admin/events/[id]/products`  
**Action Name**: `createProduct`  
**Method**: POST (via routeAction$)

**Input Schema** (Zod):
```typescript
z.object({
  inventoryGroupId: z.string().uuid(),
  name: z.string().min(1).max(100),
  price: z.number().positive(),
  maxQuantity: z.number().int().min(0),
  features: z.array(z.string()).default([]),
  imageUrl: z.string().url().optional(),
})
```

**Response**:
```typescript
{
  success: true,
  data: {
    id: string,
    eventId: string,
    inventoryGroupId: string,
    name: string,
    price: number,
    maxQuantity: number,
    features: string[],
    imageUrl?: string,
    stripeProductId: string,
    soldQuantity: number,
  }
}
```

**Side Effects**:
- Creates corresponding Stripe product
- Stores `stripeProductId` in database

**Errors**:
- `400`: Invalid input
- `403`: User not authorized
- `404`: Event or inventory group not found
- `502`: Stripe API error

---

### 3. Update Product

**Route**: `/admin/events/[id]/products`  
**Action Name**: `updateProduct`  
**Method**: POST (via routeAction$)

**Input Schema**:
```typescript
z.object({
  productId: z.string().uuid(),
  name: z.string().min(1).max(100).optional(),
  price: z.number().positive().optional(),
  maxQuantity: z.number().int().min(0).optional(),
  features: z.array(z.string()).optional(),
  imageUrl: z.string().url().optional(),
})
```

**Response**: Same as Create Product

**Errors**:
- `400`: Invalid input
- `403`: User not authorized
- `404`: Product not found

---

### 4. Delete Product

**Route**: `/admin/events/[id]/products`  
**Action Name**: `deleteProduct`  
**Method**: POST (via routeAction$)

**Input Schema**:
```typescript
z.object({
  productId: z.string().uuid(),
})
```

**Response**:
```typescript
{
  success: true
}
```

**Business Rules**:
- Cannot delete product with existing transactions
- Should soft-delete or check for dependencies

**Errors**:
- `400`: Product has transactions
- `403`: User not authorized
- `404`: Product not found

---

### 5. Initiate Checkout

**Route**: `/events/[id]/checkout`  
**Action Name**: `initiateCheckout`  
**Method**: POST (via routeAction$)

**Input Schema**:
```typescript
z.object({
  selections: z.array(
    z.object({
      productId: z.string().uuid(),
      quantity: z.number().int().positive(),
    })
  ).min(1),
})
```

**Validation Rules**:
- Maximum one product per inventory group (critical business rule)
- Each product quantity must not exceed maxQuantity (unless maxQuantity=0)
- Total quantity per inventory group must not exceed remaining capacity

**Response**:
```typescript
{
  success: true,
  data: {
    checkoutUrl: string,  // Stripe checkout session URL
    sessionId: string,     // For polling transaction status
  }
}
```

**Side Effects**:
- Validates inventory availability
- Validates one product per inventory group constraint
- Validates maxQuantity constraints
- Creates Stripe checkout session
- Stores session metadata for webhook processing

**Errors**:
- `400`: Invalid input
- `400`: Multiple products from same inventory group selected
- `400`: Insufficient inventory
- `400`: Exceeds maxQuantity limit
- `404`: Product not found
- `502`: Stripe API error

---

### 6. Check Transaction Status

**Route**: `/events/[id]/checkout`  
**Action Name**: `checkTransactionStatus`  
**Method**: POST (via routeAction$)

**Purpose**: Polling endpoint for frontend to check if webhook has processed payment

**Input Schema**:
```typescript
z.object({
  sessionId: z.string(),  // Stripe session ID
})
```

**Response**:
```typescript
{
  success: true,
  data: {
    status: 'pending' | 'completed' | 'failed',
    transactionId?: string,  // Present if status=completed
  }
}
```

**Errors**:
- `404`: Session not found

---

### 7. Mark Ticket Scanned

**Route**: `/admin/events/[id]/tickets`  
**Action Name**: `scanTicket`  
**Method**: POST (via routeAction$)

**Input Schema**:
```typescript
z.object({
  qrCodeUuid: z.string().uuid(),
})
```

**Response**:
```typescript
{
  success: true,
  data: {
    ticketId: string,
    productName: string,
    buyerName: string,
    scannedAt: string,
    alreadyScanned: boolean,
    previousScanAt?: string,
  }
}
```

**Errors**:
- `404`: Ticket not found (invalid QR code)
- `400`: Ticket for different event

---

## Route Loaders (Queries)

### 8. Get Event Products (Public)

**Route**: `/events/[id]/products`  
**Loader Name**: `productLoader`  
**Method**: GET (via routeLoader$)

**Response**:
```typescript
{
  event: {
    id: string,
    title: string,
    startDate: string,
    endDate: string,
  },
  inventoryGroups: Array<{
    id: string,
    name: string,
    maxCapacity: number,
    needsTicket: boolean,
    soldQuantity: number,
    remainingCapacity: number,
    products: Array<{
      id: string,
      name: string,
      price: number,
      maxQuantity: number,
      features: string[],
      imageUrl?: string,
      soldQuantity: number,
    }>
  }>
}
```

**Business Logic**:
- Calculate `remainingCapacity` = maxCapacity - sum(products.soldQuantity)
- Group products by inventoryGroupId

---

### 9. Get Event Products (Admin)

**Route**: `/admin/events/[id]/products`  
**Loader Name**: `adminProductsLoader`  
**Method**: GET (via routeLoader$)

**Response**:
```typescript
{
  inventoryGroups: Array<{
    id: string,
    name: string,
    maxCapacity: number,
    needsTicket: boolean,
    soldQuantity: number,
    products: Array<{
      id: string,
      name: string,
      price: number,
      maxQuantity: number,
      features: string[],
      imageUrl?: string,
      stripeProductId: string,
      soldQuantity: number,
      createdAt: string,
      updatedAt: string,
    }>
  }>
}
```

**Authorization**: Requires user to be event owner

---

### 10. Get Event Transactions

**Route**: `/admin/events/[id]/transactions`  
**Loader Name**: `transactionsLoader`  
**Method**: GET (via routeLoader$)

**Query Parameters**:
- `cursor`: string (optional, for pagination)
- `limit`: number (default: 20, max: 100)

**Response**:
```typescript
{
  transactions: Array<{
    id: string,
    totalAmount: number,
    transactionFee: number,
    paymentDate: string,
    buyer: {
      id: string,
      name: string,
      email: string,
    },
    items: Array<{
      productName: string,
      quantity: number,
      unitPrice: number,
    }>,
  }>,
  nextCursor?: string,
}
```

**Authorization**: Requires user to be event owner

---

### 11. Get Event Tickets

**Route**: `/admin/events/[id]/tickets`  
**Loader Name**: `ticketsLoader`  
**Method**: GET (via routeLoader$)

**Query Parameters**:
- `cursor`: string (optional, for pagination)
- `limit`: number (default: 50, max: 500)

**Response**:
```typescript
{
  tickets: Array<{
    id: string,
    qrCodeUuid: string,
    productName: string,
    buyer: {
      id: string,
      name: string,
      email: string,
    },
    scannedAt?: string,
    createdAt: string,
  }>,
  nextCursor?: string,
  stats: {
    total: number,
    scanned: number,
    unscanned: number,
  }
}
```

**Authorization**: Requires user to be event owner

---

### 12. Get User Tickets

**Route**: `/profile/tickets/`  
**Loader Name**: `userTicketsLoader`  
**Method**: GET (via routeLoader$)

**Response**:
```typescript
{
  tickets: Array<{
    id: string,
    qrCodeUuid: string,
    event: {
      id: string,
      title: string,
      startDate: string,
      endDate: string,
      location: string,
    },
    product: {
      name: string,
      features: string[],
    },
    scannedAt?: string,
    qrCodeUrl: string,  // /tickets/[id]/qr_code.png
  }>,
  upcomingEvents: Array<{ ... }>,
  pastEvents: Array<{ ... }>,
}
```

**Authorization**: Requires authenticated user

---

## API Endpoints (Traditional REST)

### 13. Stripe Webhook

**Route**: `/api/webhooks/stripe`  
**Method**: POST  
**Authentication**: Stripe signature verification

**Input**: Stripe webhook event (JSON)

**Handled Event Types**:
- `checkout.session.completed`: Process successful payment

**Processing Logic**:
```typescript
1. Verify webhook signature
2. Check event type
3. If checkout.session.completed:
   a. Extract metadata (eventId, userId, products)
   b. Check if transaction already exists (stripeSessionId)
   c. If exists: return 200 (idempotent)
   d. Create transaction record
   e. Create transaction_items
   f. Increment product soldQuantity
   g. Generate tickets (if needsTicket=true)
   h. Send confirmation email
   i. Send Telegram notification (one message per product):
      Format per product:
      📦 Product: ${productName} (x${quantity})
      💰 Amount: €${amount.toFixed(2)}
      📊 Remaining inventory: ${remainingInventory}
4. Return 200 OK
```

**Response**: `200 OK` (always, even on errors - Stripe retries otherwise)

**Idempotency**: Check `transactions.stripeSessionId` before insert

---

### 14. Generate QR Code

**Route**: `/admin/events/[id]/tickets/[ticket-id]/qr-code.png`  
**Method**: GET  
**Authentication**: None (public endpoint with UUID protection)

**Response**: PNG image (Content-Type: image/png)

**Headers**:
```typescript
{
  'Content-Type': 'image/png',
  'Cache-Control': 'public, max-age=31536000, immutable',  // Infinite browser cache
  'ETag': '[ticket-id]',
}
```

**Business Logic**:
```typescript
1. Query ticket by ticketId (database ID, not qrCodeUuid)
2. If not found: 404
3. Generate QR code from qrCodeUuid
4. Return PNG buffer with cache headers
```

**Caching Strategy**: 
- Browser caches infinitely (QR codes never change)
- CDN can also cache with same duration
- ETag based on ticket ID for validation

**Security**: ticketId is UUID, hard to enumerate. qrCodeUuid is separate, encoded in QR.

---

## Validation Schemas Summary

### ProductSelection
```typescript
{
  productId: uuid,
  quantity: int, min: 1
}
```

### InventoryGroupInput
```typescript
{
  name: string, min: 1, max: 100,
  maxCapacity: int, min: 1,
  needsTicket: boolean, default: true
}
```

### ProductInput
```typescript
{
  inventoryGroupId: uuid,
  name: string, min: 1, max: 100,
  price: number, min: 0.01,
  maxQuantity: int, min: 0,
  features: string[],
  imageUrl?: url
}
```

---

## Error Response Format

All route actions follow consistent error format:

```typescript
{
  success: false,
  error: string,  // Human-readable error message
  fieldErrors?: Record<string, string[]>  // Zod validation errors
}
```

**Standard HTTP Status Codes**:
- `200`: Success (in response body)
- `400`: Bad request / Validation error
- `401`: Not authenticated
- `403`: Not authorized
- `404`: Resource not found
- `500`: Internal server error
- `502`: External service error (Stripe, email)

---

## Webhook Security

### Stripe Signature Verification
```typescript
import { stripe } from '~/services/stripe.service';
import { env } from '~/env';

export const onPost = async (request: Request) => {
  const sig = request.headers.get('stripe-signature');
  const rawBody = await request.text();
  
  try {
    const event = stripe.webhooks.constructEvent(
      rawBody,
      sig!,
      env.STRIPE_WEBHOOK_SECRET
    );
    // Process event
  } catch (err) {
    return new Response('Webhook signature verification failed', { 
      status: 400 
    });
  }
};
```

---

## Rate Limiting (Recommendations)

Consider implementing rate limiting for:

1. **Checkout initiation**: 10 requests/minute per IP
2. **QR code generation**: 100 requests/minute per IP
3. **Ticket scanning**: 30 requests/minute per user

Implementation can use simple in-memory store or Redis for production.

---

**Contracts Complete**: All endpoints defined with input/output schemas, validation rules, and error handling patterns. Ready for implementation.
