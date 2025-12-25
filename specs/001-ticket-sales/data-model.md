# Data Model: Ticket Sales System

**Date**: 2025-12-25  
**Feature**: 001-ticket-sales

## Overview

Database schema for ticket sales system integrated with existing Event entity. Follows Drizzle ORM + drizzle-zod patterns established in project constitution.

---

## Entity Relationship Diagram

```
┌──────────────┐
│    users     │ (existing)
│──────────────│
│ id (PK)      │◄────────┐
│ email        │         │
│ name         │         │
└──────────────┘         │
                         │
                         │
┌──────────────┐         │
│   events     │ (existing, extended)
│──────────────│         │
│ id (PK)      │◄────────┼────────┐
│ title        │         │        │
│ startDate    │         │        │
│ endDate      │         │        │
│ userId  (FK) ├─────────┘        │
└──────────────┘                  │
       │                          │
       │                          │
       ├──────────────────────────┼────────────────────┐
       │                          │                    │
       ▼                          │                    │
┌──────────────────┐              │                    │
│ inventory_groups │              │                    │
│──────────────────│              │                    │
│ id (PK)          │              │                    │
│ eventId (FK)     ├──────────────┘                    │
│ name             │                                   │
│ maxCapacity      │                                   │
│ needsTicket      │                                   │
└──────────────────┘                                   │
       │                                               │
       │ 1:N                                           │
       ▼                                               │
┌──────────────────┐                                   │
│    products      │                                   │
│──────────────────│                                   │
│ id (PK)          │                                   │
│ eventId (FK)     ├───────────────────────────────────┘
│ inventoryGrId(FK)├──────────┐
│ name             │          │
│ price            │          │
│ maxQuantity      │          │
│ features         │          │
│ imageUrl         │          │
│ stripeProductId  │          │
│ soldQuantity     │          │
└──────────────────┘          │
       │                      │
       │ 1:N                  │
       │                      │
       ▼                      │
┌─────────────────────┐       │
│ transaction_items   │       │
│─────────────────────│       │
│ id (PK)             │       │
│ transactionId (FK)  ├───┐   │
│ productId (FK)      ├───┼───┘
│ quantity            │   │
│ unitPrice           │   │
└─────────────────────┘   │
                          │
                          │
                ┌─────────┴──────────┐
                │                    │
                ▼                    │
┌──────────────────────┐             │
│    transactions      │             │
│──────────────────────│             │
│ id (PK)              │◄────────────┘
│ eventId (FK)         │
│ userId (FK)          │
│ totalAmount          │
│ transactionFee       │
│ stripeSessionId      │
│ stripePaymentId      │
│ paymentDate          │
└──────────────────────┘
       │
       │ 1:N
       ▼
┌──────────────────────┐
│      tickets         │
│──────────────────────│
│ id (PK)              │
│ qrCodeUuid           │
│ transactionId (FK)   │
│ productId (FK)       │
│ eventId (FK)         │
│ buyerId (FK)         │
│ scannedAt            │
└──────────────────────┘
```

---

## Schema Definitions

### 1. inventory_groups

**Purpose**: Defines capacity pools shared by multiple products (e.g., "General Admission" with 500 capacity shared by "Early Bird" and "Regular" products).

```typescript
// src/db/schemas/inventory-groups.ts
import { relations, sql } from "drizzle-orm";
import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";
import { events } from "./events";
import { products } from "./products";
import crypto from "crypto";

export const inventoryGroups = sqliteTable("inventory_groups", {
  id: text("id").primaryKey(),
  eventId: text("event_id")
    .notNull()
    .references(() => events.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  maxCapacity: integer("max_capacity").notNull(),
  needsTicket: integer("needs_ticket", { mode: "boolean" }).notNull().default(true),
  createdAt: text("created_at")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
});

export const inventoryGroupsRelations = relations(inventoryGroups, ({ one, many }) => ({
  event: one(events, {
    fields: [inventoryGroups.eventId],
    references: [events.id],
  }),
  products: many(products),
}));

const baseInsertSchema = createInsertSchema(inventoryGroups);
const baseSelectSchema = createSelectSchema(inventoryGroups);

export const insertInventoryGroupSchema = baseInsertSchema
  .extend({
    id: z.string().uuid().default(() => crypto.randomUUID()),
    createdAt: z.string().default(() => new Date().toISOString()),
  })
  .partial({
    id: true,
    createdAt: true,
  });

export const updateInventoryGroupSchema = baseInsertSchema
  .omit({ id: true, createdAt: true })
  .partial();

export const selectInventoryGroupSchema = baseSelectSchema;

export type InventoryGroup = z.infer<typeof selectInventoryGroupSchema>;
export type InsertInventoryGroup = z.infer<typeof insertInventoryGroupSchema>;
export type UpdateInventoryGroup = z.infer<typeof updateInventoryGroupSchema>;
```

**Fields**:
- `id`: UUID primary key
- `eventId`: Foreign key to events table (cascade delete)
- `name`: Display name (e.g., "General Admission", "VIP Section")
- `maxCapacity`: Total capacity for this group (integer)
- `needsTicket`: Boolean - if true, generate tickets with QR codes; if false, only record transaction
- `createdAt`: Timestamp

**Validation Rules**:
- `maxCapacity` must be positive integer
- `name` cannot be empty
- `eventId` must reference valid event

**State Transitions**: N/A (static configuration)

---

### 2. products

**Purpose**: Defines ticket types/products that customers can purchase. Multiple products can share the same inventory group.

```typescript
// src/db/schemas/products.ts
import { relations, sql } from "drizzle-orm";
import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";
import { events } from "./events";
import { inventoryGroups } from "./inventory-groups";
import { transactionItems } from "./transaction-items";
import crypto from "crypto";

export const products = sqliteTable("products", {
  id: text("id").primaryKey(),
  eventId: text("event_id")
    .notNull()
    .references(() => events.id, { onDelete: "cascade" }),
  inventoryGroupId: text("inventory_group_id")
    .notNull()
    .references(() => inventoryGroups.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  price: real("price").notNull(),
  maxQuantity: integer("max_quantity").notNull().default(0),
  features: text("features", { mode: "json" }).notNull().$type<string[]>(),
  imageUrl: text("image_url"),
  stripeProductId: text("stripe_product_id"),
  soldQuantity: integer("sold_quantity").notNull().default(0),
  createdAt: text("created_at")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
});

export const productsRelations = relations(products, ({ one, many }) => ({
  event: one(events, {
    fields: [products.eventId],
    references: [events.id],
  }),
  inventoryGroup: one(inventoryGroups, {
    fields: [products.inventoryGroupId],
    references: [inventoryGroups.id],
  }),
  transactionItems: many(transactionItems),
}));

const baseInsertSchema = createInsertSchema(products);
const baseSelectSchema = createSelectSchema(products);

export const insertProductSchema = baseInsertSchema
  .extend({
    id: z.string().uuid().default(() => crypto.randomUUID()),
    price: z.number().positive(),
    maxQuantity: z.number().int().min(0),
    features: z.array(z.string()).default([]),
    createdAt: z.string().default(() => new Date().toISOString()),
    updatedAt: z.string().default(() => new Date().toISOString()),
  })
  .partial({
    id: true,
    stripeProductId: true,
    soldQuantity: true,
    createdAt: true,
    updatedAt: true,
  });

export const updateProductSchema = baseInsertSchema
  .omit({ id: true, createdAt: true, soldQuantity: true })
  .partial()
  .extend({
    updatedAt: z.string().default(() => new Date().toISOString()),
  });

export const selectProductSchema = baseSelectSchema;

export type Product = z.infer<typeof selectProductSchema>;
export type InsertProduct = z.infer<typeof insertProductSchema>;
export type UpdateProduct = z.infer<typeof updateProductSchema>;
```

**Fields**:
- `id`: UUID primary key
- `eventId`: Foreign key to events (cascade delete)
- `inventoryGroupId`: Foreign key to inventory_groups (cascade delete)
- `name`: Product name (e.g., "Early Bird Ticket", "VIP Pass")
- `price`: Price in EUR (stored as real/float, decimal precision 2)
- `maxQuantity`: Maximum quantity per transaction (0 = unlimited, subject to inventory)
- `features`: JSON array of feature strings (e.g., ["Lunch included", "Front row seating"])
- `imageUrl`: URL to product image (S3)
- `stripeProductId`: Stripe product ID for checkout
- `soldQuantity`: Running total of units sold (updated via transaction)
- `createdAt`: Timestamp
- `updatedAt`: Timestamp

**Validation Rules**:
- `price` must be positive
- `maxQuantity` must be non-negative (0 = unlimited)
- `features` must be array of strings
- Cannot set `soldQuantity` greater than inventory group capacity

**State Transitions**: `soldQuantity` increments on successful transaction

---

### 3. transactions

**Purpose**: Records completed payments from Stripe. Created via webhook after successful checkout.

```typescript
// src/db/schemas/transactions.ts
import { relations, sql } from "drizzle-orm";
import { sqliteTable, text, real } from "drizzle-orm/sqlite-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";
import { events } from "./events";
import { users } from "./users";
import { transactionItems } from "./transaction-items";
import { tickets } from "./tickets";
import crypto from "crypto";

export const transactions = sqliteTable("transactions", {
  id: text("id").primaryKey(),
  eventId: text("event_id")
    .notNull()
    .references(() => events.id),
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  totalAmount: real("total_amount").notNull(),
  transactionFee: real("transaction_fee").notNull().default(0),
  stripeSessionId: text("stripe_session_id").notNull().unique(),
  stripePaymentId: text("stripe_payment_id"),
  paymentDate: text("payment_date")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
  createdAt: text("created_at")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
});

export const transactionsRelations = relations(transactions, ({ one, many }) => ({
  event: one(events, {
    fields: [transactions.eventId],
    references: [events.id],
  }),
  user: one(users, {
    fields: [transactions.userId],
    references: [users.id],
  }),
  items: many(transactionItems),
  tickets: many(tickets),
}));

const baseInsertSchema = createInsertSchema(transactions);
const baseSelectSchema = createSelectSchema(transactions);

export const insertTransactionSchema = baseInsertSchema
  .extend({
    id: z.string().uuid().default(() => crypto.randomUUID()),
    totalAmount: z.number().positive(),
    transactionFee: z.number().min(0),
    paymentDate: z.string().default(() => new Date().toISOString()),
    createdAt: z.string().default(() => new Date().toISOString()),
  })
  .partial({
    id: true,
    stripePaymentId: true,
    paymentDate: true,
    createdAt: true,
  });

export const selectTransactionSchema = baseSelectSchema;

export type Transaction = z.infer<typeof selectTransactionSchema>;
export type InsertTransaction = z.infer<typeof insertTransactionSchema>;
```

**Fields**:
- `id`: UUID primary key
- `eventId`: Foreign key to events
- `userId`: Foreign key to users (buyer)
- `totalAmount`: Total payment amount in EUR
- `transactionFee`: Stripe transaction fee in EUR
- `stripeSessionId`: Stripe checkout session ID (unique, for idempotency)
- `stripePaymentId`: Stripe payment intent ID (optional)
- `paymentDate`: ISO timestamp of payment
- `createdAt`: Record creation timestamp

**Validation Rules**:
- `totalAmount` must be positive
- `transactionFee` must be non-negative
- `stripeSessionId` must be unique (prevents duplicate processing)

**State Transitions**: Immutable after creation (no updates, only inserts)

---

### 4. transaction_items

**Purpose**: Line items for each transaction, recording what products were purchased.

```typescript
// src/db/schemas/transaction-items.ts
import { relations, sql } from "drizzle-orm";
import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";
import { transactions } from "./transactions";
import { products } from "./products";
import crypto from "crypto";

export const transactionItems = sqliteTable("transaction_items", {
  id: text("id").primaryKey(),
  transactionId: text("transaction_id")
    .notNull()
    .references(() => transactions.id, { onDelete: "cascade" }),
  productId: text("product_id")
    .notNull()
    .references(() => products.id),
  quantity: integer("quantity").notNull(),
  unitPrice: real("unit_price").notNull(),
  createdAt: text("created_at")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
});

export const transactionItemsRelations = relations(transactionItems, ({ one }) => ({
  transaction: one(transactions, {
    fields: [transactionItems.transactionId],
    references: [transactions.id],
  }),
  product: one(products, {
    fields: [transactionItems.productId],
    references: [products.id],
  }),
}));

const baseInsertSchema = createInsertSchema(transactionItems);
const baseSelectSchema = createSelectSchema(transactionItems);

export const insertTransactionItemSchema = baseInsertSchema
  .extend({
    id: z.string().uuid().default(() => crypto.randomUUID()),
    quantity: z.number().int().positive(),
    unitPrice: z.number().positive(),
    createdAt: z.string().default(() => new Date().toISOString()),
  })
  .partial({
    id: true,
    createdAt: true,
  });

export const selectTransactionItemSchema = baseSelectSchema;

export type TransactionItem = z.infer<typeof selectTransactionItemSchema>;
export type InsertTransactionItem = z.infer<typeof insertTransactionItemSchema>;
```

**Fields**:
- `id`: UUID primary key
- `transactionId`: Foreign key to transactions (cascade delete)
- `productId`: Foreign key to products
- `quantity`: Number of units purchased
- `unitPrice`: Price per unit at time of purchase (snapshot, may differ from current product price)
- `createdAt`: Timestamp

**Validation Rules**:
- `quantity` must be positive integer
- `unitPrice` must be positive

**State Transitions**: Immutable after creation

---

### 5. tickets

**Purpose**: Individual tickets generated for products with `needsTicket=true`. Each ticket has unique QR code for scanning.

```typescript
// src/db/schemas/tickets.ts
import { relations, sql } from "drizzle-orm";
import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";
import { transactions } from "./transactions";
import { products } from "./products";
import { events } from "./events";
import { users } from "./users";
import crypto from "crypto";

export const tickets = sqliteTable("tickets", {
  id: text("id").primaryKey(),
  qrCodeUuid: text("qr_code_uuid").notNull().unique(),
  transactionId: text("transaction_id")
    .notNull()
    .references(() => transactions.id),
  productId: text("product_id")
    .notNull()
    .references(() => products.id),
  eventId: text("event_id")
    .notNull()
    .references(() => events.id),
  buyerId: text("buyer_id")
    .notNull()
    .references(() => users.id),
  scannedAt: text("scanned_at"),
  createdAt: text("created_at")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
});

export const ticketsRelations = relations(tickets, ({ one }) => ({
  transaction: one(transactions, {
    fields: [tickets.transactionId],
    references: [transactions.id],
  }),
  product: one(products, {
    fields: [tickets.productId],
    references: [products.id],
  }),
  event: one(events, {
    fields: [tickets.eventId],
    references: [events.id],
  }),
  buyer: one(users, {
    fields: [tickets.buyerId],
    references: [users.id],
  }),
}));

const baseInsertSchema = createInsertSchema(tickets);
const baseSelectSchema = createSelectSchema(tickets);

export const insertTicketSchema = baseInsertSchema
  .extend({
    id: z.string().uuid().default(() => crypto.randomUUID()),
    qrCodeUuid: z.string().uuid().default(() => crypto.randomUUID()),
    createdAt: z.string().default(() => new Date().toISOString()),
  })
  .partial({
    id: true,
    qrCodeUuid: true,
    scannedAt: true,
    createdAt: true,
  });

export const updateTicketSchema = baseInsertSchema
  .pick({ scannedAt: true })
  .partial();

export const selectTicketSchema = baseSelectSchema;

export type Ticket = z.infer<typeof selectTicketSchema>;
export type InsertTicket = z.infer<typeof insertTicketSchema>;
export type UpdateTicket = z.infer<typeof updateTicketSchema>;
```

**Fields**:
- `id`: UUID primary key (internal database ID)
- `qrCodeUuid`: UUID for QR code (separate from ID for security)
- `transactionId`: Foreign key to transactions
- `productId`: Foreign key to products
- `eventId`: Foreign key to events
- `buyerId`: Foreign key to users
- `scannedAt`: ISO timestamp when ticket was scanned (nullable)
- `createdAt`: Timestamp

**Validation Rules**:
- `qrCodeUuid` must be unique
- `scannedAt` can only be set once (no un-scanning)

**State Transitions**: 
- Created with `scannedAt = null`
- Set `scannedAt` when scanned (irreversible)

---

## Extension to Existing Schema

### events (extended)

**New Relations**:
```typescript
// Add to existing eventsRelations in src/db/schemas/events.ts
export const eventsRelations = relations(events, ({ one, many }) => ({
  user: one(users, {
    fields: [events.userId],
    references: [users.id],
  }),
  // NEW relations below
  inventoryGroups: many(inventoryGroups),
  products: many(products),
  transactions: many(transactions),
  tickets: many(tickets),
}));
```

No schema changes to `events` table itself, only relations.

---

## Indexes

**Performance-critical queries requiring indexes**:

```sql
-- Transaction lookup by Stripe session (webhook idempotency)
CREATE INDEX idx_transactions_stripe_session ON transactions(stripe_session_id);

-- Ticket lookup by QR code UUID (scanning)
CREATE UNIQUE INDEX idx_tickets_qr_code ON tickets(qr_code_uuid);

-- Tickets by event (admin list)
CREATE INDEX idx_tickets_event_id ON tickets(event_id);

-- Products by event (product selection page)
CREATE INDEX idx_products_event_id ON products(event_id);

-- Transactions by user (user dashboard)
CREATE INDEX idx_transactions_user_id ON transactions(user_id);

-- Transactions by event (admin transactions tab)
CREATE INDEX idx_transactions_event_id ON transactions(event_id);
```

These indexes should be added to Drizzle migration files.

---

## Data Integrity Constraints

### Inventory Validation
**Business Rule**: Sum of `products.soldQuantity` for products in same `inventoryGroupId` cannot exceed `inventoryGroups.maxCapacity`.

**Enforcement**: Application-level validation in `inventory-groups.service.ts` within transaction.

### Idempotency
**Business Rule**: Same Stripe checkout session cannot create multiple transactions.

**Enforcement**: `transactions.stripeSessionId` unique constraint + application-level check before insert.

### Quantity Limits
**Business Rule**: Purchase quantity cannot exceed `products.maxQuantity` (unless maxQuantity=0).

**Enforcement**: Application-level validation before creating Stripe session.

### Inventory Group Selection
**Business Rule**: Customer can select maximum ONE product per inventory group.

**Enforcement**: Application-level validation during product selection. If multiple products share an inventory group, only one can be added to cart.

---

## Migration Strategy

### Step 1: Create new tables
```bash
npm run db:generate  # Generate migration from schema changes
npm run db:migrate   # Apply migration
```

### Step 2: Extend events relations
Update `src/db/schemas/events.ts` to add new relations (no migration needed, Drizzle runtime only).

### Step 3: Update schema aggregator
Update `src/db/schema.ts` to export new schemas:
```typescript
export * from "./schemas/inventory-groups";
export * from "./schemas/products";
export * from "./schemas/transactions";
export * from "./schemas/transaction-items";
export * from "./schemas/tickets";
```

---

## Example Data Flow

### Creating Event Products
```
1. Admin creates inventory group:
   - name: "General Admission"
   - maxCapacity: 500
   - needsTicket: true

2. Admin creates products:
   - Product A: "Early Bird" | price: €50 | inventoryGroupId: [group-id]
   - Product B: "Regular" | price: €75 | inventoryGroupId: [group-id]
   
3. Both products share 500 capacity pool
```

### Customer Purchase Flow
```
1. Customer selects:
   - Product A (from Group 1): quantity 2
   - Product C (from Group 2): quantity 1
   - NOTE: Cannot select both Product A and Product B if they share Group 1
   
2. System validates:
   - One product per group rule: Each selected product has different inventoryGroupId ✓
   - Group capacity: soldQuantity(A) + 2 <= Group1.maxCapacity ✓
   - Group capacity: soldQuantity(C) + 1 <= Group2.maxCapacity ✓
   - Product A maxQuantity: 2 <= maxQuantity(A) ✓
   - Product C maxQuantity: 1 <= maxQuantity(C) ✓
   
3. Create Stripe checkout session with metadata

4. Webhook receives payment confirmation:
   - Create transaction record
   - Create 2 transaction_items (A×2, C×1)
   - Increment soldQuantity: A += 2, C += 1
   - Generate 3 tickets (if needsTicket=true for both groups)
   - Each ticket gets unique id and qrCodeUuid
   - Send email with QR codes
```

### Ticket Scanning Flow
```
1. Staff scans QR code → extracts qrCodeUuid

2. System queries:
   - WHERE qrCodeUuid = [scanned-uuid]
   
3. Check scannedAt:
   - If null → mark as scanned, set scannedAt = NOW()
   - If not null → show "Already scanned at [timestamp]"
```

---

**Data Model Complete**: All entities defined, relationships established, validation rules documented. Ready for contract generation.
