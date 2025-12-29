# Quickstart: Event Participation Tracking & Enhanced Features

**Feature**: 002-event-participation-tracking  
**Date**: 2025-12-29  
**Phase**: 1 - Design

This guide provides a high-level overview of the feature and technology choices for developers joining the implementation.

---

## Feature Overview

This feature enhances the CMS event management system with:

1. **Participation Tracking** - Users can RSVP (yes/no/maybe) independent of ticket purchases
2. **Sales Periods** - Time-bound ticket availability (early bird, regular sales, etc.)
3. **Free Events** - Events without payment requirements
4. **Ticket Scanning** - Attendance verification via QR codes (adapts existing system)
5. **Private Event Photos** - Photos accessible only to verified attendees

---

## Technology Stack

### Core Technologies (Existing)
- **Framework**: Qwik 1.7+ (SSR + client hydration)
- **Database**: SQLite (dev) / Turso (prod) via Drizzle ORM 0.45+
- **Validation**: Zod 4.2+ for schemas and API inputs
- **Styling**: Tailwind CSS 3.4+
- **Auth**: Session-based (existing)

### New Dependencies
- **Photo Storage**: Cloudflare R2 (S3-compatible, zero egress fees)
- **R2 SDK**: AWS SDK for JavaScript v3 (already installed, R2 compatible)
- **QR Scanning**: html5-qrcode 2.3.8 (already installed)
- **Date Handling**: date-fns 3.6.0 (already installed)

**No new npm packages required!** All necessary dependencies already installed.

---

## Architecture Overview

### Database Changes

**New Tables**:
1. `participants` - User-event mappings with status (yes/no/maybe/verified)
2. `event_photos` - Photo metadata with storage keys

**Modified Tables**:
1. `events` - Add `isFree` boolean
2. `inventory_groups` - Add `salesStartDate`, `salesEndDate`
3. `products` - Add `participantCapacity` integer

### Service Layer

**New Services**:
- `src/services/participants.service.ts` - Participation CRUD + status tracking
- `src/services/event-photos.service.ts` - Photo upload, access control, URL generation

**Modified Services**:
- `src/services/tickets.service.ts` - Extend `scanTicket()` to update participant status

### Routes

**New Routes**:
- `src/routes/api/events/[id]/participants/` - Participation API
- `src/routes/api/events/[id]/photos/` - Photo upload/list/delete
- `src/routes/events/[id]/photos/` - Attendee photo gallery UI
- `src/routes/admin/events/[id]/photos/` - Organizer photo management

**Modified Routes**:
- `src/routes/events/[id]/` - Add RSVP UI
- `src/routes/admin/events/[id]/` - Add participant dashboard

---

## Key Design Decisions

### 1. Participants as Independent Entities

**Why**: Decouples participation intent from ticket purchases. Users can RSVP "maybe" before buying tickets, or attend free events without payment flow.

**Implementation**:
- `participants` table: unique (userId, eventId) mapping
- Status: `yes` (confirmed), `no` (declined), `maybe` (interested), `verified` (ticket scanned)
- Participants are system users (create user if doesn't exist during RSVP)

### 2. Sales Periods on Inventory Groups (Not Events/Products)

**Why**: Enables multiple pricing tiers with different sales windows (early bird, regular, VIP).

**Implementation**:
- Add `salesStartDate`, `salesEndDate` to `inventory_groups` table
- Early bird inventory: separate group with earlier start/end dates
- Regular inventory: separate group with later start/end dates
- Null dates = no restrictions

### 3. Event-Level `isFree` Flag (Not Ticket-Level)

**Why**: Simplifies checkout logic. Event is either free or paid (binary decision).

**Implementation**:
- Free events: Skip Stripe, create participant with status `yes` directly
- Paid events: Participant created after successful payment
- All tickets generated with QR codes (free or paid)

### 4. Reuse Existing Ticket Scanning

**Why**: System already has `tickets.scannedAt` and `ticketsService.scanTicket()`. Don't reinvent.

**Implementation**:
- Extend `scanTicket()` to also update `participants.status = verified`
- Keep existing validation (duplicate scan prevention, ticket authenticity)
- UI feedback mechanisms already in place

### 5. Simplified Photo Schema with `key` Field

**Why**: Storage key (S3 object key) is sufficient identifier. No size variants or complex metadata.

**Implementation**:
- `event_photos`: id, eventId, key, uploadedAt, uploadedBy
- Key format: `events/{eventId}/photos/{uuid}.{ext}`
- Pre-signed URLs generated on-demand (1 hour expiration)
- Access control: Check `participants.status = verified` before generating URL

---

## Data Flow Examples

### Free Event RSVP
```
User → Click "RSVP" 
     → POST /api/events/:id/participants { status: "yes" }
     → participantsService.create({ userId, eventId, status: "yes" })
     → DB INSERT into participants
     → Response: { success: true, data: participant }
```

### Paid Event Ticket Purchase
```
User → Select product (check sales period)
     → Collect participant details (if capacity > 1)
     → Stripe checkout
     → Webhook success
     → ticketsService.create() + participantsService.create({ status: "yes" })
     → Generate QR code
     → Email ticket
```

### Ticket Scanning
```
Scanner → Scan QR code (get qrCodeUuid)
        → POST /api/tickets/scan { qrCodeUuid }
        → ticketsService.scanTicket(qrCodeUuid)
          ├─ UPDATE tickets SET scannedAt = now() WHERE qrCodeUuid = :uuid AND scannedAt IS NULL
          └─ UPDATE participants SET status = 'verified' WHERE userId = :buyerId AND eventId = :eventId
        → Response: { ticket, participant } or { error: "Already scanned" }
```

### Private Photo Access
```
User → View event/:id/photos
     → routeLoader$ checks: participants.status = 'verified'?
     → If yes: fetch event_photos for eventId
     → Generate pre-signed URLs (1 hour expiration) for each photo
     → Render gallery with URLs
     → If no: 403 Forbidden
```

---

## Environment Configuration

Add to `src/env.ts`:

```typescript
export const env = z.object({
  // Existing env vars...
  
  // Cloudflare R2 Configuration
  R2_ACCOUNT_ID: z.string().min(1),
  R2_ACCESS_KEY_ID: z.string().min(1),
  R2_SECRET_ACCESS_KEY: z.string().min(1),
  R2_BUCKET_NAME: z.string().default("event-photos"),
  R2_PUBLIC_URL: z.string().url().optional(),
  
  // Photo URL expiration (seconds)
  PHOTO_URL_EXPIRATION: z.coerce.number().int().positive().default(3600),  // 1 hour
}).parse(process.env);
```

Add to `.env.example`:
```
R2_ACCOUNT_ID=your_cloudflare_account_id
R2_ACCESS_KEY_ID=your_r2_access_key
R2_SECRET_ACCESS_KEY=your_r2_secret_key
R2_BUCKET_NAME=event-photos
PHOTO_URL_EXPIRATION=3600
```

---

## Database Migrations

Run in order:

```bash
# Generate migration files
npm run db:generate

# Apply migrations
npm run db:migrate
```

**Migration sequence**:
1. Add `isFree` to events
2. Add `salesStartDate`, `salesEndDate` to inventory_groups
3. Add `participantCapacity` to products
4. Create `participants` table
5. Create `event_photos` table

See `specs/002-event-participation-tracking/data-model.md` for SQL.

---

## Development Workflow

### 1. Setup R2 Bucket
```bash
# Using Cloudflare CLI (wrangler)
wrangler r2 bucket create event-photos

# Or via Cloudflare dashboard:
# 1. Navigate to R2 → Create bucket
# 2. Name: event-photos
# 3. Copy credentials to .env
```

### 2. Create Schemas
```typescript
// src/db/schemas/participants.ts
export const participants = sqliteTable("participants", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id),
  eventId: text("event_id").notNull().references(() => events.id),
  status: text("status").notNull(),  // CHECK constraint in migration
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

// Export Zod schemas
export const insertParticipantSchema = createInsertSchema(participants).extend({
  id: z.string().uuid().default(() => crypto.randomUUID()),
  status: z.enum(["yes", "no", "maybe", "verified"]),
  // ...
});
```

### 3. Create Services
```typescript
// src/services/participants.service.ts
export const participantsService = {
  async create(data: InsertParticipant): Promise<Participant> {
    const validated = insertParticipantSchema.parse(data);
    const [participant] = await db.insert(participants).values(validated).returning();
    return participant;
  },
  
  async updateStatus(userId: string, eventId: string, status: string): Promise<Participant | undefined> {
    // Validate status, prevent changing from "verified"
    const [participant] = await db.update(participants)
      .set({ status, updatedAt: new Date().toISOString() })
      .where(and(eq(participants.userId, userId), eq(participants.eventId, eventId)))
      .returning();
    return participant;
  },
  
  // More methods...
};
```

### 4. Create Route Actions
```typescript
// src/routes/api/events/[id]/participants/index.ts
export const onPost = routeAction$(async ({ params, request }, { cookie }) => {
  const session = await getSession(cookie);
  if (!session) return fail(401, { error: "Unauthorized" });
  
  const body = await request.json();
  const { status } = createParticipantSchema.parse(body);
  
  const participant = await participantsService.create({
    userId: session.userId,
    eventId: params.id,
    status,
  });
  
  return { success: true, data: participant };
}, zod$(createParticipantSchema));
```

---

## Testing Strategy

### Unit Tests
```typescript
// tests/unit/services/participants.service.test.ts
describe("participantsService", () => {
  it("creates participant with valid status", async () => {
    const result = await participantsService.create({
      userId: "user-123",
      eventId: "event-456",
      status: "yes",
    });
    expect(result.status).toBe("yes");
  });
  
  it("prevents setting status to verified manually", async () => {
    await expect(participantsService.create({
      userId: "user-123",
      eventId: "event-456",
      status: "verified",
    })).rejects.toThrow();
  });
});
```

### Integration Tests
```typescript
// tests/integration/ticket-scanning.test.ts
describe("Ticket Scanning", () => {
  it("updates participant status to verified on scan", async () => {
    const ticket = await createTestTicket();
    const response = await fetch("/api/tickets/scan", {
      method: "POST",
      body: JSON.stringify({ qrCodeUuid: ticket.qrCodeUuid }),
    });
    
    expect(response.ok).toBe(true);
    const data = await response.json();
    expect(data.participant.status).toBe("verified");
  });
});
```

---

## Security Checklist

- ✅ Photos: Check `participants.status = verified` before URL generation
- ✅ Uploads: Validate file type, size, user is organizer
- ✅ Scanning: Prevent duplicate scans via transaction
- ✅ Sales period: Server-side validation (not just client)
- ✅ Status updates: Prevent manual setting of "verified"
- ✅ Foreign keys: Prevent orphaned records
- ✅ Pre-signed URLs: 1 hour expiration, no caching beyond window

---

## Performance Optimizations

### Indexes
```sql
CREATE INDEX idx_participants_event_status ON participants(event_id, status);
CREATE INDEX idx_participants_user ON participants(user_id);
CREATE INDEX idx_event_photos_event ON event_photos(event_id);
```

### Caching Opportunities
- Photo URL generation (cache URLs for 1 hour)
- Participation counts (denormalize if queries slow)
- Sales period checks (cache inventory group data)

### Pagination
- Photo galleries: Cursor-based, 50 per page
- Participant lists: Cursor-based, 100 per page

---

## Common Pitfalls

### ❌ Don't: Store full photo URLs in database
**Why**: URLs change when credentials rotate. Store keys, generate URLs on-demand.

### ❌ Don't: Allow manual setting of "verified" status
**Why**: Only ticket scanning should mark attendance. Prevents fraud.

### ❌ Don't: Validate sales period client-side only
**Why**: Easy to bypass. Always validate server-side before checkout.

### ❌ Don't: Create separate participant records for multi-capacity products
**Why**: Participants are user-event mappings (one per user per event). Capacity is product metadata.

### ✅ Do: Use transactions for ticket scanning
**Why**: Prevents race conditions when multiple devices scan same ticket.

### ✅ Do: Check event.isFree before Stripe checkout
**Why**: Free events skip payment flow entirely.

### ✅ Do: Generate pre-signed URLs with expiration
**Why**: Prevents URL sharing and unauthorized access.

---

## Next Steps

1. **Phase 1 Complete**: Review data-model.md and contracts
2. **Phase 2**: Break down into implementation tasks (`/speckit.tasks`)
3. **Phase 3**: Implement schemas, services, routes
4. **Phase 4**: Write tests, deploy

---

## Resources

- **Feature Spec**: `specs/002-event-participation-tracking/spec.md`
- **Research**: `specs/002-event-participation-tracking/research.md`
- **Data Model**: `specs/002-event-participation-tracking/data-model.md`
- **API Contracts**: `specs/002-event-participation-tracking/contracts/api-contracts.md`
- **Constitution**: `.specify/memory/constitution.md`
- **Cloudflare R2 Docs**: https://developers.cloudflare.com/r2/
- **Drizzle ORM Docs**: https://orm.drizzle.team/
- **Qwik Docs**: https://qwik.builder.io/

---

## Questions?

Refer to:
1. Constitution for coding patterns
2. Data model for schema details
3. API contracts for endpoint specs
4. Research doc for technology rationale

If stuck: Ask in team chat or review existing similar features (events, tickets).
