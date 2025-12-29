# Data Model: Event Participation Tracking & Enhanced Features

**Feature**: 002-event-participation-tracking  
**Date**: 2025-12-29  
**Phase**: 1 - Design

## Entity Overview

This feature introduces 2 new tables and modifies 3 existing tables:

**New Tables**:
- `participants` - User-event mappings with participation status
- `event_photos` - Private photos accessible only to verified attendees

**Modified Tables**:
- `events` - Add `isFree` flag
- `inventory_groups` - Add `salesStartDate`, `salesEndDate` 
- `products` - Add `participantCapacity`

## Entity Definitions

### 1. Participants (NEW)

User-event mappings tracking participation intent and attendance verification.

**Table**: `participants`

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | text (UUID) | PRIMARY KEY | Unique identifier |
| userId | text (UUID) | NOT NULL, FK → users.id | System user reference |
| eventId | text (UUID) | NOT NULL, FK → events.id | Event reference |
| status | text (enum) | NOT NULL | Participation status: `yes`, `no`, `maybe`, `verified` |
| createdAt | text (ISO 8601) | NOT NULL, default CURRENT_TIMESTAMP | Record creation time |
| updatedAt | text (ISO 8601) | NOT NULL, default CURRENT_TIMESTAMP | Last status update time |

**Indexes**:
- Unique constraint: `(userId, eventId)` - one participation record per user per event
- Index: `(eventId, status)` - fast aggregation for organizer dashboard
- Index: `(userId)` - fast lookup for user's event list

**Relationships**:
- `userId` → `users.id` (many-to-one)
- `eventId` → `events.id` (many-to-one)

**Validation Rules**:
- Status must be one of: `yes`, `no`, `maybe`, `verified`
- User must exist in users table
- Event must exist in events table
- Once status is `verified`, cannot be changed back (terminal state)

**State Transitions**:
```
null → yes/no/maybe (user RSVP or ticket purchase)
yes/no/maybe ↔ yes/no/maybe (user changes mind)
yes → verified (ticket scanned at event)
verified → verified (terminal state, no changes allowed)
```

---

### 2. Event Photos (NEW)

Private photos uploaded by organizers, accessible only to verified attendees.

**Table**: `event_photos`

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | text (UUID) | PRIMARY KEY | Unique identifier |
| eventId | text (UUID) | NOT NULL, FK → events.id | Event reference |
| key | text | NOT NULL, UNIQUE | Storage key (e.g., `events/{eventId}/photos/{uuid}.jpg`) |
| uploadedAt | text (ISO 8601) | NOT NULL, default CURRENT_TIMESTAMP | Upload timestamp |
| uploadedBy | text (UUID) | NOT NULL, FK → users.id | Organizer who uploaded |

**Indexes**:
- Index: `(eventId)` - fast lookup of all photos for an event
- Unique: `(key)` - ensures no duplicate storage keys

**Relationships**:
- `eventId` → `events.id` (many-to-one)
- `uploadedBy` → `users.id` (many-to-one)

**Validation Rules**:
- Key must follow pattern: `events/{eventId}/photos/{uuid}.{ext}`
- Event must exist
- Uploader must be event organizer (checked in service layer)
- File extension must be valid image type: jpg, jpeg, png, heic, webp

**Access Control**:
- Photos visible ONLY to users with participant status = `verified` for the event
- Service layer checks attendance before generating pre-signed URL
- URLs expire after 1 hour

---

### 3. Events (MODIFIED)

Add free event flag to existing events table.

**New Field**: `isFree`

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| isFree | integer (boolean) | NOT NULL, default false | Whether event is free (no payment required) |

**Impact**:
- Determines checkout flow (skip Stripe for free events)
- Free events: RSVP creates participant with status `yes` directly
- Paid events: Participant created after successful payment
- All other event fields remain unchanged

**Migration**:
- Default existing events to `isFree = false` (assume paid unless configured)

---

### 4. Inventory Groups (MODIFIED)

Add sales period dates to control when products in the group are available for purchase.

**New Fields**: `salesStartDate`, `salesEndDate`

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| salesStartDate | text (ISO 8601) | NULLABLE | Sales open timestamp (UTC) |
| salesEndDate | text (ISO 8601) | NULLABLE | Sales close timestamp (UTC) |

**Validation Rules**:
- If both set: `salesStartDate < salesEndDate`
- If set: Both dates should be within event date range (optional warning)
- Null means no restriction (always available)

**Impact**:
- Products in this inventory group only purchasable within sales period
- Early bird inventory: separate group with earlier start/end dates
- Regular inventory: separate group with later start/end dates
- Checkout validates current time is within period

**Examples**:
```
Early Bird Inventory:
- salesStartDate: 2025-09-01T00:00:00Z (4 months before event)
- salesEndDate: 2025-11-01T00:00:00Z (2 months before event)

Regular Inventory:
- salesStartDate: 2025-11-01T00:00:00Z (2 months before event)
- salesEndDate: 2025-12-24T00:00:00Z (1 week before event)
```

**Migration**:
- Existing inventory groups: set both fields to null (no restrictions)

---

### 5. Products (MODIFIED)

Add participant capacity to support products requiring multiple participant details.

**New Field**: `participantCapacity`

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| participantCapacity | integer | NOT NULL, default 1 | Number of participants per product unit |

**Validation Rules**:
- Must be >= 1
- Default: 1 (buyer only)
- Capacity > 1: Checkout collects details for all capacity slots

**Impact**:
- Single product purchase → N participant records
- Hotel room with capacity 2 → 2 participants linked to 1 ticket
- Checkout validates all capacity slots have complete details before payment

**Examples**:
```
Single Ticket Product:
- participantCapacity: 1
- Checkout collects buyer info only

Hotel Room Product:
- participantCapacity: 2
- Checkout collects info for 2 participants (names, emails, dietary requirements)

Group Package:
- participantCapacity: 4
- Checkout collects info for 4 participants
```

**Participant Linking**:
- Participants linked to ticket via `(userId, eventId)` matching ticket's `(buyerId, eventId)`
- One ticket can have multiple associated participants
- Participants table stores individual details for each capacity slot

**Migration**:
- Existing products: set `participantCapacity = 1` (single participant per ticket)

---

### 6. Tickets (UNCHANGED - Reference)

Existing ticket table already has `scannedAt` field for attendance tracking. No schema changes needed.

**Relevant Fields**:
| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | text (UUID) | PRIMARY KEY | Unique identifier |
| qrCodeUuid | text (UUID) | NOT NULL, UNIQUE | QR code payload |
| transactionId | text (UUID) | NOT NULL, FK → transactions.id | Purchase transaction |
| productId | text (UUID) | NOT NULL, FK → products.id | Product purchased |
| eventId | text (UUID) | NOT NULL, FK → events.id | Event reference |
| buyerId | text (UUID) | NOT NULL, FK → users.id | Ticket purchaser |
| scannedAt | text (ISO 8601) | NULLABLE | Timestamp when ticket scanned |
| createdAt | text (ISO 8601) | NOT NULL | Ticket creation time |

**Behavior Changes**:
- Scanning now also updates participant status to `verified`
- Existing scanTicket service method extended to update participants table

---

## Relationship Diagram

```
users
  ├── participants (1:N) - user's event participations
  ├── tickets (1:N) - user's purchased tickets
  └── event_photos (1:N) - photos uploaded by user

events
  ├── participants (1:N) - event's participants
  ├── tickets (1:N) - event's tickets
  ├── event_photos (1:N) - event's private photos
  ├── inventory_groups (1:N) - event's inventory groups
  └── products (1:N) - event's products

inventory_groups
  ├── products (1:N) - products in group
  ├── NEW: salesStartDate - sales window start
  └── NEW: salesEndDate - sales window end

products
  ├── tickets (1:N) - tickets from product
  └── NEW: participantCapacity - participants per unit

tickets
  ├── buyer (N:1 → users) - who purchased
  ├── product (N:1 → products) - what was purchased
  ├── event (N:1 → events) - which event
  └── scannedAt - attendance verification

participants (NEW)
  ├── user (N:1 → users) - who is participating
  ├── event (N:1 → events) - which event
  └── status - participation/attendance status

event_photos (NEW)
  ├── event (N:1 → events) - which event
  ├── uploadedBy (N:1 → users) - who uploaded
  └── key - storage reference
```

---

## Data Flows

### Free Event RSVP
```
1. User clicks "RSVP" for free event
2. Create/update participant record (status = `yes`)
3. Optionally generate free ticket (scannedAt = null)
4. Display confirmation
```

### Paid Event Ticket Purchase
```
1. User selects product (checks inventory_groups.salesStartDate/salesEndDate)
2. If product.participantCapacity > 1: collect participant details
3. Stripe checkout
4. On success: create ticket + create/update participant (status = `yes`)
5. Generate QR code from ticket.qrCodeUuid
```

### Ticket Scanning
```
1. Scanner scans QR code (reads qrCodeUuid)
2. Server validates ticket exists, belongs to event
3. If not scanned: update tickets.scannedAt = now()
4. Update participants.status = `verified` (where userId = ticket.buyerId, eventId = ticket.eventId)
5. Return success with buyer details
6. If already scanned: return error with original scan timestamp
```

### Private Photo Access
```
1. User views past event
2. Server checks: participant exists with status = `verified`?
3. If yes: fetch event_photos for eventId
4. Generate pre-signed URLs (1 hour expiration) for each photo
5. Return photo list with URLs
6. If no: return empty list or access denied
```

### Sales Period Validation
```
1. User browses event products
2. For each product: fetch inventory_groups.salesStartDate/salesEndDate
3. If current_time < salesStartDate: show "Sales open on {date}"
4. If salesStartDate <= current_time <= salesEndDate: show "Buy" button
5. If current_time > salesEndDate: show "Sales closed"
6. Server validates again during checkout (prevent client-side bypass)
```

---

## Migration Scripts (Drizzle)

### Migration 1: Add `isFree` to events
```sql
ALTER TABLE events ADD COLUMN is_free INTEGER NOT NULL DEFAULT 0;
```

### Migration 2: Add sales period to inventory_groups
```sql
ALTER TABLE inventory_groups ADD COLUMN sales_start_date TEXT;
ALTER TABLE inventory_groups ADD COLUMN sales_end_date TEXT;
```

### Migration 3: Add participantCapacity to products
```sql
ALTER TABLE products ADD COLUMN participant_capacity INTEGER NOT NULL DEFAULT 1;
```

### Migration 4: Create participants table
```sql
CREATE TABLE participants (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  event_id TEXT NOT NULL REFERENCES events(id),
  status TEXT NOT NULL CHECK(status IN ('yes', 'no', 'maybe', 'verified')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, event_id)
);

CREATE INDEX idx_participants_event_status ON participants(event_id, status);
CREATE INDEX idx_participants_user ON participants(user_id);
```

### Migration 5: Create event_photos table
```sql
CREATE TABLE event_photos (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL REFERENCES events(id),
  key TEXT NOT NULL UNIQUE,
  uploaded_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  uploaded_by TEXT NOT NULL REFERENCES users(id)
);

CREATE INDEX idx_event_photos_event ON event_photos(event_id);
```

---

## Query Patterns

### Get participation summary for event
```typescript
// Count by status for organizer dashboard
const summary = await db
  .select({ status: participants.status, count: sql`COUNT(*)` })
  .from(participants)
  .where(eq(participants.eventId, eventId))
  .groupBy(participants.status);
// Returns: [{ status: 'yes', count: 45 }, { status: 'maybe', count: 12 }, ...]
```

### Check if user can access photos
```typescript
const participant = await db.query.participants.findFirst({
  where: and(
    eq(participants.userId, userId),
    eq(participants.eventId, eventId),
    eq(participants.status, 'verified')
  )
});
const canAccess = !!participant;
```

### Get tickets with buyer and participant info
```typescript
const ticketsWithDetails = await db.query.tickets.findMany({
  where: eq(tickets.eventId, eventId),
  with: {
    buyer: true,
    product: true,
  }
});
// Then join with participants on (buyerId, eventId)
```

### Check if product is available for purchase
```typescript
const product = await db.query.products.findFirst({
  where: eq(products.id, productId),
  with: { inventoryGroup: true }
});

const now = new Date();
const salesStart = product.inventoryGroup.salesStartDate ? new Date(product.inventoryGroup.salesStartDate) : null;
const salesEnd = product.inventoryGroup.salesEndDate ? new Date(product.inventoryGroup.salesEndDate) : null;

const isAvailable = 
  (!salesStart || now >= salesStart) &&
  (!salesEnd || now <= salesEnd);
```

---

## Validation Summary

### Participants
- Status enum validation (yes/no/maybe/verified)
- Unique per user-event pair
- Verified status is terminal (no changes after set)

### Event Photos
- Key format validation (events/{eventId}/photos/{uuid}.{ext})
- File extension whitelist (jpg, jpeg, png, heic, webp)
- Access control: verified participants only

### Sales Period
- Start < End if both set
- Server-side validation during checkout
- Nullable = no restrictions

### Participant Capacity
- Integer >= 1
- Checkout collects N participant details
- Validates all slots complete before payment

---

## Performance Considerations

### Indexes
- `participants(eventId, status)` - fast aggregation for dashboards
- `participants(userId, eventId)` - unique constraint, also speeds lookups
- `event_photos(eventId)` - fast photo listing
- `event_photos(key)` - unique constraint for storage

### Potential Optimizations
- Cache participation counts (denormalize if query becomes slow)
- Cache pre-signed URLs (1 hour TTL) to reduce S3 API calls
- Paginate photo galleries (cursor-based, 20-50 per page)
- Consider read replicas if query load increases

---

## Security Considerations

### Access Control
- Photos: Check participant.status = verified before URL generation
- Ticket scanning: Validate qrCodeUuid authenticity, check for duplicate
- Sales period: Server-side validation only (client checks are hints)

### Data Validation
- All inputs validated via Zod schemas (insertParticipantSchema, etc.)
- Status enum enforced at database level
- Foreign keys prevent orphaned records

### Audit Trail
- All tables have createdAt/updatedAt timestamps
- Ticket scannedAt provides attendance audit
- Photo uploadedBy tracks who uploaded what

---

## Testing Strategy

### Unit Tests (Service Layer)
- participantsService.create/update/getStatus
- eventPhotosService.upload/generateUrl/checkAccess
- ticketsService.scanTicket (extended)

### Integration Tests (Full Flows)
- Free event RSVP → participant creation → ticket generation
- Paid event purchase → payment → participant + ticket creation
- Ticket scanning → scannedAt update → participant status = verified
- Photo access → check verified status → generate URL

### Contract Tests (API)
- POST /api/events/:id/participants (RSVP)
- GET /api/events/:id/participants (summary)
- POST /api/tickets/scan (scan QR code)
- GET /api/events/:id/photos (photo list with URLs)
- POST /api/events/:id/photos (upload)

---

## Open Questions

None - all data model decisions finalized based on research phase and user corrections.
