# Data Model: Event Participation Tracking & Enhanced Features

**Feature**: 002-event-participation-tracking  
**Date**: 2025-12-29  
**Phase**: 1 - Design & Contracts

## Entity Definitions

### Modified Entities

#### 1. Events (Modified)

Existing table with new field for free event support.

**Fields**:
- `id` (text, PK): UUID, unique event identifier
- `title` (text, required): Event name
- `body` (text, required): Event description/content
- `startDate` (text, required): ISO 8601 UTC timestamp
- `endDate` (text, required): ISO 8601 UTC timestamp
- `locationType` (text, required): Location type (physical/online)
- `address` (text, nullable): Physical address if applicable
- `city` (text, nullable): City name
- `country` (text, nullable): Country name
- `longitude` (text, nullable): GPS coordinate
- `latitude` (text, nullable): GPS coordinate
- `onlineUrl` (text, nullable): Online event URL
- `userId` (text, required, FK → users.id): Event organizer
- **`isFree` (boolean, required, default: false)**: NEW - Indicates if event is completely free
- `createdAt` (text, required): ISO 8601 UTC timestamp
- `updatedAt` (text, required): ISO 8601 UTC timestamp

**Relationships**:
- Belongs to: User (organizer)
- Has many: InventoryGroups, Products, Tickets, Participants, EventPhotos

**Validation Rules**:
- `startDate` < `endDate`
- If `locationType` = 'physical', require address fields
- If `locationType` = 'online', require `onlineUrl`
- If `isFree` = true, all products should be free (business logic, not DB constraint)

**State Transitions**:
- Draft → Published → Concluded (based on dates, not stored in DB)

---

#### 2. InventoryGroups (Modified)

Groups of products with shared capacity and sales period configuration.

**Fields**:
- `id` (text, PK): UUID
- `eventId` (text, required, FK → events.id, cascade delete): Parent event
- `name` (text, required): Group name (e.g., "Early Bird", "Regular")
- `maxCapacity` (integer, required): Maximum number of products in this group
- `needsTicket` (boolean, required, default: true): Whether products generate tickets
- **`salesStartDate` (text, nullable)**: NEW - ISO 8601 UTC, when sales open
- **`salesEndDate` (text, nullable)**: NEW - ISO 8601 UTC, when sales close
- `createdAt` (text, required): ISO 8601 UTC timestamp

**Relationships**:
- Belongs to: Event
- Has many: Products

**Validation Rules**:
- `salesStartDate` < `salesEndDate` (if both provided)
- `salesStartDate` >= `event.startDate` (if provided)
- `salesEndDate` <= `event.endDate` (if provided)
- `maxCapacity` > 0

**Business Logic**:
- Check current timestamp against sales period before allowing purchase
- If dates null, sales always open (within event lifecycle)

---

#### 3. Tickets (Existing - No Changes)

Ticket records already support scanning via `scannedAt` field.

**Fields**:
- `id` (text, PK): UUID
- `qrCodeUuid` (text, required, unique): UUID for QR code scanning
- `transactionId` (text, required, FK → transactions.id): Purchase reference
- `productId` (text, required, FK → products.id): Product purchased
- `eventId` (text, required, FK → events.id): Event reference
- `buyerId` (text, required, FK → users.id): Ticket purchaser
- `scannedAt` (text, nullable): ISO 8601 UTC timestamp when ticket scanned (NULL = not scanned)
- `createdAt` (text, required): ISO 8601 UTC timestamp

**Relationships**:
- Belongs to: Transaction, Product, Event, User (buyer)

**Validation Rules**:
- `qrCodeUuid` must be unique across all tickets
- `scannedAt` must be after `createdAt`
- `scannedAt` can only be set once (immutable after scanning)

---

### New Entities

#### 4. Participants (NEW)

User-event mappings for participation tracking. Independent from tickets.

**Fields**:
- `id` (text, PK): UUID
- `userId` (text, required, FK → users.id): Participant (normal system user)
- `eventId` (text, required, FK → events.id): Event reference
- `status` (text, required): Enum - 'yes', 'no', 'maybe', 'verified'
- `createdAt` (text, required): ISO 8601 UTC timestamp
- `updatedAt` (text, required): ISO 8601 UTC timestamp

**Relationships**:
- Belongs to: User, Event
- No direct relationship to Tickets (linked conceptually via userId + eventId)

**Validation Rules**:
- Unique constraint on (userId, eventId) - one participation status per user per event
- Status must be one of: 'yes', 'no', 'maybe', 'verified'

**State Transitions**:
```
any → any (user can change mind)
verified → verified (terminal state, cannot be unset)

Transition triggers:
- User clicks "Yes" (free event) → status = 'yes'
- User completes ticket purchase (paid event) → status = 'yes'
- User clicks "Maybe" → status = 'maybe'
- User clicks "No" → status = 'no'
- Ticket scanned → status = 'verified'
```

**Business Logic**:
- Create user record if doesn't exist during RSVP (participants are normal system users)
- For paid events, "Yes" requires completing ticket purchase
- For free events, "Yes" is immediate
- Ticket scanning sets status to 'verified' atomically with tickets.scannedAt

---

#### 5. EventPhotos (NEW)

Private photos uploaded by organizers, accessible only to verified attendees.

**Fields**:
- `id` (text, PK): UUID
- `eventId` (text, required, FK → events.id, cascade delete): Event reference
- `key` (text, required, unique): S3/R2 object key (e.g., `events/{eventId}/photos/{uuid}.jpg`)
- `uploadedAt` (text, required): ISO 8601 UTC timestamp
- `uploadedBy` (text, required, FK → users.id): User who uploaded (typically organizer)

**Relationships**:
- Belongs to: Event, User (uploader)
- Has many: PhotoAccessUrls (optional)

**Validation Rules**:
- `key` must be unique across all photos
- File must exist in R2 before creating record (verify upload)
- Supported formats: JPEG, PNG, HEIC, WebP (validated by MIME type if stored)

**Business Logic**:
- Access control: Only users with participant.status = 'verified' can request URLs
- Photos are private by default (R2 bucket policy)
- Pre-signed URLs generated on-demand with 1-hour expiration

---

#### 6. PhotoAccessUrls (NEW - Optional)

Cache table for pre-signed URLs to avoid regenerating on every request.

**Fields**:
- `id` (text, PK): UUID
- `photoId` (text, required, FK → event_photos.id, cascade delete): Photo reference
- `url` (text, required): Pre-signed S3/R2 URL
- `expiresAt` (text, required): ISO 8601 UTC timestamp when URL expires
- `generatedAt` (text, required): ISO 8601 UTC timestamp

**Relationships**:
- Belongs to: EventPhoto

**Validation Rules**:
- `expiresAt` > `generatedAt`
- URLs valid for 1 hour (expiresAt = generatedAt + 3600 seconds)

**Business Logic**:
- Check if cached URL exists and not expired before generating new one
- Clean up expired URLs periodically (cron job or on-demand)
- Optional table: Can implement if performance optimization needed

---

## Entity Relationship Diagram

```
┌─────────────┐
│   Users     │
└──────┬──────┘
       │
       ├─────────────────────────────────────┐
       │                                     │
       │ organizes                           │ participates
       │                                     │
       ▼                                     ▼
┌─────────────┐                      ┌──────────────┐
│   Events    │◄─────────────────────│ Participants │
│  + isFree   │                      │  (NEW)       │
└──────┬──────┘                      └──────────────┘
       │                              status: yes/no/maybe/verified
       │
       ├──────────┬───────────┬──────────────┐
       │          │           │              │
       │          │           │              │
       ▼          ▼           ▼              ▼
┌──────────┐  ┌────────┐  ┌────────┐  ┌─────────────┐
│Inventory │  │Products│  │Tickets │  │ EventPhotos │
│  Groups  │  └────┬───┘  └───┬────┘  │   (NEW)     │
│  (MOD)   │       │          │       └──────┬──────┘
└────┬─────┘       │          │              │
     │             │          │              │
     │ + sales     │          │ scannedAt    │ key (S3)
     │   periods   │          │              │
     │             │          │              ▼
     │             │          │       ┌─────────────┐
     │             │          │       │PhotoAccess  │
     │             │          │       │   Urls      │
     │             │          │       │ (optional)  │
     └─────────────┴──────────┴───────┴─────────────┘

Relationships:
- Events → InventoryGroups (1:N)
- Events → Participants (1:N)
- Events → EventPhotos (1:N)
- InventoryGroups → Products (1:N)
- Users → Participants (1:N)
- Users → Events (1:N, as organizer)
- Users → EventPhotos (1:N, as uploader)
- EventPhotos → PhotoAccessUrls (1:N, optional)
- Tickets: Existing relationships unchanged
```

---

## Key Data Flows

### 1. Ticket Scanning Flow

```
1. Organizer scans QR code → extract qrCodeUuid
2. Server validates ticket:
   - Ticket exists
   - Belongs to current event
   - scannedAt is NULL
3. Database transaction:
   - Update tickets.scannedAt = NOW()
   - Update participants.status = 'verified' WHERE userId = ticket.buyerId AND eventId = ticket.eventId
4. Return success + attendee info
```

### 2. Free Event RSVP Flow

```
1. User clicks "RSVP" on free event (events.isFree = true)
2. Check if user exists:
   - If not, create user record from provided email/name
3. Create or update participant:
   - INSERT INTO participants (userId, eventId, status = 'yes')
   - ON CONFLICT (userId, eventId) DO UPDATE SET status = 'yes'
4. Optionally generate ticket (for scanning purposes)
5. Send confirmation email
```

### 3. Paid Event Ticket Purchase Flow

```
1. User clicks "Buy Ticket" on paid event
2. Stripe checkout process
3. On successful payment:
   - Create ticket record
   - Create or update participant:
     - INSERT INTO participants (userId, eventId, status = 'yes')
     - ON CONFLICT DO UPDATE SET status = 'yes'
4. Generate QR code from ticket.qrCodeUuid
5. Send ticket email
```

### 4. Private Photo Access Flow

```
1. User requests event photo gallery
2. Server checks participant status:
   - Query: SELECT status FROM participants WHERE userId = ? AND eventId = ?
   - Require: status = 'verified'
3. If verified:
   - Query: SELECT * FROM event_photos WHERE eventId = ?
   - For each photo:
     - Check cached URL (if photo_access_urls table exists)
     - If not cached or expired, generate pre-signed URL (1-hour expiration)
     - Return photo list with URLs
4. If not verified:
   - Return 403 Forbidden
```

### 5. Sales Period Validation Flow

```
1. User attempts to purchase product
2. Server queries inventory group:
   - SELECT salesStartDate, salesEndDate FROM inventory_groups WHERE id = product.inventoryGroupId
3. Validate:
   - IF salesStartDate IS NOT NULL AND NOW() < salesStartDate → "Sales not started"
   - IF salesEndDate IS NOT NULL AND NOW() > salesEndDate → "Sales ended"
   - ELSE → Allow purchase
4. UI mirrors this logic for button state
```

---

## Migration Strategy

### Phase 1: Schema Changes

1. **Add to events table**: `isFree BOOLEAN DEFAULT false`
2. **Add to inventory_groups table**: `salesStartDate TEXT NULL, salesEndDate TEXT NULL`
3. **Create participants table** with fields as specified above
4. **Create event_photos table** with fields as specified above
5. **Create photo_access_urls table** (optional) with fields as specified above

### Phase 2: Data Migration

1. **Events**: All existing events default to `isFree = false` (no migration needed, column has default)
2. **InventoryGroups**: All existing groups have NULL sales periods (always open, no migration needed)
3. **Participants**: Create participant records for existing ticket buyers:
   ```sql
   INSERT INTO participants (id, userId, eventId, status, createdAt, updatedAt)
   SELECT uuid(), buyerId, eventId, 'yes', createdAt, createdAt
   FROM tickets
   ON CONFLICT (userId, eventId) DO NOTHING;
   ```
4. **Verified Participants**: Update participants to 'verified' for scanned tickets:
   ```sql
   UPDATE participants
   SET status = 'verified', updatedAt = tickets.scannedAt
   FROM tickets
   WHERE participants.userId = tickets.buyerId
     AND participants.eventId = tickets.eventId
     AND tickets.scannedAt IS NOT NULL;
   ```

### Phase 3: Rollback Plan

If rollback needed:
1. Drop `photo_access_urls` table (no dependencies)
2. Drop `event_photos` table (no dependencies)
3. Drop `participants` table (no dependencies)
4. Remove `isFree` column from events (or leave as-is with default false)
5. Remove sales period columns from inventory_groups (or leave as NULL)

**Note**: Rollback safe because new tables have no FK constraints to existing tables. Modified tables only add nullable/default columns.

---

## Performance Considerations

1. **Indexes**:
   - `participants(userId, eventId)` - Unique index, supports fast participation lookups
   - `participants(eventId, status)` - For counting participation by status
   - `event_photos(eventId)` - For fetching gallery per event
   - `photo_access_urls(photoId, expiresAt)` - For cache lookups
   - `tickets(qrCodeUuid)` - Already unique, used for scanning

2. **Query Optimization**:
   - Participation counts: Precompute or cache `COUNT(*) GROUP BY status`
   - Photo galleries: Paginate if > 100 photos per event
   - Pre-signed URL generation: Cache in photo_access_urls table to reduce SDK calls

3. **Scalability**:
   - R2 storage: Unlimited storage, zero egress fees
   - Database: SQLite suitable for ~10k events, consider Turso for production scale
   - Photo URLs: Consider CDN caching with signed cookies for high-traffic events

---

## Security Considerations

1. **Photo Access Control**:
   - Never expose R2 bucket publicly
   - Always check participant.status = 'verified' before generating URLs
   - Pre-signed URLs expire in 1 hour (prevent long-term sharing)

2. **Ticket Scanning**:
   - Use database transactions to prevent race conditions
   - Log all scan attempts for audit trail
   - Rate limit scanning endpoint (e.g., 100 scans/minute per IP)

3. **Participation Status**:
   - Only allow status updates by the participant user or organizer
   - Prevent setting status = 'verified' via API (only through scanning)

4. **Sales Period Bypass**:
   - Validate sales period server-side (never trust client)
   - Use database timestamps for authoritative time source

---

## Testing Requirements

1. **Unit Tests**:
   - Participants service: Create, update, query by status
   - Ticket scanning service: Transaction handling, duplicate detection
   - Photo access service: URL generation, expiration handling
   - Sales period validation: Date range checks

2. **Integration Tests**:
   - Free event RSVP → participant creation → status update
   - Paid event purchase → participant creation → ticket generation
   - Ticket scan → participant verified → photo access granted
   - Sales period enforcement → block purchases outside window

3. **Edge Cases**:
   - Concurrent ticket scans (same UUID, multiple devices)
   - Expired photo URL regeneration
   - Participant status changes after ticket purchase
   - Sales period updates after tickets sold

---

## Summary

This data model extends the existing events/tickets system with:
- **2 modified tables** (events, inventory_groups) - backward compatible
- **3 new tables** (participants, event_photos, photo_access_urls)
- **Clear separation** between participation intent (participants) and actual tickets
- **Event-level free flag** for simplified free event handling
- **Inventory-level sales periods** for flexible pricing tiers
- **Private photo storage** with time-limited secure access
- **Simplified schema** following user-requested changes (participants independent, no phone field, key instead of difference, etc.)

All entities follow Drizzle ORM and Zod schema patterns per project constitution.
