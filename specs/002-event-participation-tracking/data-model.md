# Data Model: Event Participation Tracking & Enhanced Features

**Date**: 2025-12-29  
**Source**: Feature spec + research decisions

## Entity Overview

```
┌────────────┐         ┌──────────────────┐
│   Events   │◄────────│ParticipationStatus│
│            │         │                  │
│ +salesStart│         │  +status         │
│ +salesEnd  │         │  +updatedAt      │
└─────┬──────┘         └──────────────────┘
      │                          ▲
      │                          │
      │ 1:N                      │ N:1
      │                          │
      ▼                          │
┌────────────┐         ┌──────────────┐
│  Products  │         │    Users     │
│            │         │              │
│+participantCap│      └──────────────┘
└─────┬──────┘                │
      │                        │
      │ 1:N                    │ 1:N
      │                        │
      ▼                        │
┌────────────┐                 │
│  Tickets   │◄────────────────┘
│            │
│  +isFree   │
│+scannedAt  │
└─────┬──────┘
      │
      │ 1:N
      │
      ▼
┌─────────────────┐
│TicketParticipants│
│                  │
│ +participantOrder│
│ +name            │
│ +email           │
│ +phone           │
│+additionalData   │
└──────────────────┘

      ┌────────────┐
      │  Events    │
      └─────┬──────┘
            │
            │ 1:N
            │
            ▼
      ┌─────────────┐
      │EventPhotos   │
      │              │
      │ +filePath    │
      │ +uploadedAt  │
      │ +uploadedBy  │
      └──────────────┘
```

## Schema Definitions

### Extended: Events

**Purpose**: Add sales period control to event scheduling

**Fields (NEW)**:
- `salesStartDate` (text, ISO 8601, nullable): Date/time when ticket sales open
- `salesEndDate` (text, ISO 8601, nullable): Date/time when ticket sales close

**Existing Fields**: id, title, body, startDate, endDate, locationType, address, city, country, longitude, latitude, onlineUrl, userId, createdAt, updatedAt

**Validation Rules**:
- `salesStartDate` must be before `salesEndDate` if both set
- `salesEndDate` must be before or equal to `endDate`
- Both fields optional (null = no sales period restriction)

**Relations**:
- Existing: one-to-many with products, tickets, transactions, inventoryGroups
- NEW: one-to-many with eventPhotos
- NEW: one-to-many with participationStatus

**Indexes**:
- Existing: userId
- NEW: salesStartDate, salesEndDate (for filtering active sales)

---

### Extended: Products

**Purpose**: Support multi-participant products (hotel rooms, group packages)

**Fields (NEW)**:
- `participantCapacity` (integer, default 1, min 1): Number of participants per product unit

**Existing Fields**: id, eventId, inventoryGroupId, name, price, maxQuantity, features, imageUrl, stripeProductId, soldQuantity, createdAt, updatedAt

**Validation Rules**:
- `participantCapacity` must be positive integer >= 1
- Default to 1 if not specified
- Cannot decrease capacity below number of participants already registered on existing tickets

**Relations**:
- Existing: many-to-one with events, inventoryGroups; one-to-many with transactionItems
- No direct relation to ticketParticipants (indirectly via tickets)

**Indexes**:
- Existing: eventId, inventoryGroupId

---

### Extended: Tickets

**Purpose**: Support free tickets and attendance verification

**Fields (NEW)**:
- `isFree` (integer as boolean, 0 or 1, default 0): Whether ticket was issued for free

**Existing Fields**: id, qrCodeUuid, transactionId, productId, eventId, buyerId, scannedAt, createdAt

**Note**: `scannedAt` field already exists for attendance tracking - no schema change needed

**Validation Rules**:
- `isFree` is 0 (paid) or 1 (free)
- `scannedAt` is null until ticket scanned, then set to ISO 8601 timestamp
- Cannot change `isFree` after ticket creation

**Relations**:
- Existing: many-to-one with transactions, products, events, users (buyer)
- NEW: one-to-many with ticketParticipants

**Indexes**:
- Existing: qrCodeUuid (unique), transactionId, productId, eventId, buyerId
- NEW: scannedAt (for filtering attended tickets)
- NEW: (eventId, scannedAt) composite for photo access queries

---

### NEW: TicketParticipants

**Purpose**: Store details for each participant associated with a ticket

**Fields**:
- `id` (text, UUID, primary key): Unique participant record ID
- `ticketId` (text, UUID, foreign key → tickets.id): Associated ticket
- `participantOrder` (integer, >= 1): Order/position (1st, 2nd, 3rd participant)
- `name` (text, not null): Participant full name
- `email` (text, not null): Participant email
- `phone` (text, nullable): Participant phone number
- `additionalData` (text as JSON, nullable): Product-specific fields (dietary, shirt size, etc.)
- `createdAt` (text, ISO 8601, default CURRENT_TIMESTAMP): Record creation time

**Validation Rules**:
- `participantOrder` must be positive integer >= 1
- `email` must be valid email format
- Number of participants per ticket must match product.participantCapacity
- Unique constraint on (ticketId, participantOrder) - no duplicate orders

**Relations**:
- Many-to-one with tickets

**Indexes**:
- Primary: id
- Foreign key: ticketId
- Unique: (ticketId, participantOrder)

**Schema (Drizzle)**:
```typescript
export const ticketParticipants = sqliteTable("ticket_participants", {
  id: text("id").primaryKey(),
  ticketId: text("ticket_id").notNull().references(() => tickets.id, { onDelete: "cascade" }),
  participantOrder: integer("participant_order").notNull(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  phone: text("phone"),
  additionalData: text("additional_data", { mode: "json" }).$type<Record<string, any>>(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => ({
  uniqueTicketOrder: unique().on(table.ticketId, table.participantOrder),
}));
```

---

### NEW: ParticipationStatus

**Purpose**: Track user participation intent independent of ticket purchases

**Fields**:
- `id` (text, UUID, primary key): Unique status record ID
- `userId` (text, UUID, foreign key → users.id): User indicating participation
- `eventId` (text, UUID, foreign key → events.id): Event for participation
- `status` (text, enum: 'yes' | 'no' | 'maybe', not null): Participation intent
- `updatedAt` (text, ISO 8601, not null): Last status change timestamp

**Validation Rules**:
- `status` must be exactly 'yes', 'no', or 'maybe'
- Unique constraint on (userId, eventId) - one status per user per event
- For paid events: 'yes' only allowed after ticket purchase
- Auto-upgrade 'maybe' to 'yes' on ticket purchase

**Relations**:
- Many-to-one with users
- Many-to-one with events

**Indexes**:
- Primary: id
- Unique: (userId, eventId)
- Index on eventId for aggregation queries

**Schema (Drizzle)**:
```typescript
export const participationStatus = sqliteTable("participation_status", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  eventId: text("event_id").notNull().references(() => events.id, { onDelete: "cascade" }),
  status: text("status", { enum: ["yes", "no", "maybe"] }).notNull(),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => ({
  uniqueUserEvent: unique().on(table.userId, table.eventId),
}));
```

---

### NEW: EventPhotos

**Purpose**: Store references to private event photos with metadata

**Fields**:
- `id` (text, UUID, primary key): Unique photo record ID
- `eventId` (text, UUID, foreign key → events.id): Associated event
- `filePath` (text, not null): File system path to photo (e.g., `/private/events/{eventId}/photos/{uuid}.webp`)
- `uploadedBy` (text, UUID, foreign key → users.id): User who uploaded photo (organizer)
- `uploadedAt` (text, ISO 8601, default CURRENT_TIMESTAMP): Upload timestamp
- `thumbnailPath` (text, nullable): Optional thumbnail path for gallery view

**Validation Rules**:
- `filePath` must start with `/private/events/`
- `filePath` must end with `.webp` (after optimization)
- Cannot upload photos for events that haven't started yet
- Only event organizer (event.userId) can upload photos

**Relations**:
- Many-to-one with events
- Many-to-one with users (uploader)

**Indexes**:
- Primary: id
- Foreign key: eventId, uploadedBy
- Index on eventId for gallery queries

**Schema (Drizzle)**:
```typescript
export const eventPhotos = sqliteTable("event_photos", {
  id: text("id").primaryKey(),
  eventId: text("event_id").notNull().references(() => events.id, { onDelete: "cascade" }),
  filePath: text("file_path").notNull(),
  uploadedBy: text("uploaded_by").notNull().references(() => users.id),
  uploadedAt: text("uploaded_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  thumbnailPath: text("thumbnail_path"),
});
```

---

## State Transitions

### Ticket Lifecycle
```
┌─────────┐  Purchase   ┌─────────┐  Scan QR   ┌──────────┐
│ Created │────────────►│ Issued  │───────────►│ Attended │
└─────────┘             └─────────┘            └──────────┘
  isFree: 0/1          scannedAt: null       scannedAt: timestamp
```

### Participation Status Flow
```
                   ┌──────────┐
           ┌───────│  Maybe   │◄──────┐
           │       └──────────┘       │
           │                          │
    Update │                          │ Update
           │                          │
           ▼                          │
     ┌─────────┐              ┌─────────┐
     │   Yes   │              │   No    │
     └─────────┘              └─────────┘
           ▲                          ▲
           │                          │
           └─── Ticket Purchase ──────┘
           (auto-upgrade to Yes)
```

### Sales Period States
```
┌───────────────┐  salesStartDate   ┌─────────────┐  salesEndDate   ┌──────────────┐
│ Pre-Sale      │─────────────────►│   Active    │────────────────►│ Sales Closed │
└───────────────┘                   └─────────────┘                 └──────────────┘
  Can view event                     Can purchase                    Can view only
  Cannot purchase                    tickets                         Cannot purchase
```

### Photo Access Workflow
```
1. User requests photo
2. System checks: tickets.eventId = eventId AND scannedAt IS NOT NULL
3. If attended: generate signed URL (exp = now + 1 hour)
4. Return URL to client
5. Client requests photo with signed URL
6. Server validates signature + expiry
7. If valid: serve file from /private/ storage
8. If invalid/expired: return 403 Forbidden
```

---

## Aggregate Queries

### Event Statistics
```typescript
interface EventStats {
  totalTickets: number;           // Count of all tickets
  freeTickets: number;            // Count where isFree = 1
  paidTickets: number;            // Count where isFree = 0
  attendedCount: number;          // Count where scannedAt IS NOT NULL
  attendanceRate: number;         // (attendedCount / totalTickets) * 100
  participationYes: number;       // Count of 'yes' in participationStatus
  participationMaybe: number;     // Count of 'maybe'
  participationNo: number;        // Count of 'no'
  totalPhotos: number;            // Count of eventPhotos
}
```

### Query Examples
```sql
-- Get attended users for photo access
SELECT DISTINCT t.buyerId 
FROM tickets t 
WHERE t.eventId = ? AND t.scannedAt IS NOT NULL;

-- Get participation summary
SELECT status, COUNT(*) as count 
FROM participation_status 
WHERE eventId = ? 
GROUP BY status;

-- Get all participants for a ticket
SELECT * FROM ticket_participants 
WHERE ticketId = ? 
ORDER BY participantOrder ASC;

-- Check if sales are active
SELECT * FROM events 
WHERE id = ? 
  AND (salesStartDate IS NULL OR salesStartDate <= datetime('now'))
  AND (salesEndDate IS NULL OR salesEndDate >= datetime('now'));
```

---

## Migration Order

1. **events**: Add salesStartDate, salesEndDate columns (nullable)
2. **products**: Add participantCapacity column (default 1)
3. **tickets**: Add isFree column (default 0), add index on scannedAt
4. **ticket_participants**: Create table with foreign key to tickets
5. **participation_status**: Create table with unique constraint
6. **event_photos**: Create table with foreign keys to events and users

**Rollback Strategy**: Each migration is reversible via Drizzle's down migrations. Data loss risk only if dropping tables (not applicable for extensions).

---

## Data Integrity Constraints

### Referential Integrity
- All foreign keys use `onDelete: "cascade"` to maintain consistency
- Deleting event cascades to products, tickets, participations, photos
- Deleting ticket cascades to ticketParticipants

### Business Logic Constraints
- Participant count validation at application layer (service)
- Sales period validation at application layer (service)
- Photo access validation at application layer (service)
- QR code signature validation at application layer (utility)

### Database Constraints
- Unique constraints: (userId, eventId) in participationStatus
- Unique constraints: (ticketId, participantOrder) in ticketParticipants
- Unique constraints: qrCodeUuid in tickets (existing)
- Check constraints: N/A (SQLite limited, use Zod validation)

---

## Performance Optimization

### Indexes
- `tickets.scannedAt`: For attendance queries
- `tickets(eventId, scannedAt)`: Composite for photo access checks
- `participationStatus(eventId)`: For aggregation queries
- `eventPhotos(eventId)`: For gallery loading

### Caching Strategy
- Event sales period state: Cache in memory for 5 minutes
- Participation counts: Cache for 1 minute (acceptable staleness)
- Photo access validation: No caching (security-critical)
- Ticket scan status: No caching (real-time requirement)

### Query Optimization
- Use `SELECT DISTINCT` for attended user lists
- Batch insert for multiple ticketParticipants
- Eager load participants with tickets via Drizzle relations
- Lazy load photos in gallery (pagination)
