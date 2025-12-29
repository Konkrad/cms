# Research: Event Participation Tracking & Enhanced Features

**Feature**: 002-event-participation-tracking  
**Date**: 2025-12-29  
**Phase**: 0 - Research & Analysis

## Research Questions & Findings

### 1. QR Code Generation & Scanning

**Decision**: Use `qrcode` npm package (already installed) for generation, `html5-qrcode` library (already installed) for scanning

**Rationale**:
- `qrcode` package: Lightweight, supports both SVG and canvas, server-side compatible with Node.js
- `html5-qrcode` library: Already in dependencies (2.3.8), cross-browser support, mobile-friendly
- QR payload: Store UUID only (e.g., `ticket:{uuid}`), validate server-side to prevent tampering
- Scanning validation: Server must verify ticket exists, belongs to event, not already scanned

**Alternatives Considered**:
- Native HTML5 Camera API only: Lower-level, requires more complex implementation
- Third-party scanning services: Introduces external dependencies and privacy concerns
- Native mobile apps: Over-engineered for web-first use case

**Implementation Notes**:
- Generate QR on ticket creation using existing `qrCodeUuid` field
- Scanner component uses Html5QrcodeScanner with auto-start camera
- Scan result sent to server endpoint for validation
- Server responds with success/error and attendance confirmation
- Fallback: Manual UUID entry if camera unavailable

### 2. Private Photo Storage & Secure URLs

**Decision**: Use Cloudflare R2 (S3-compatible) with pre-signed URLs, 1-hour expiration

**Rationale**:
- R2: Zero egress fees, S3-compatible API, cost-effective for photo storage
- AWS SDK already installed (@aws-sdk/client-s3) - compatible with R2
- Pre-signed URLs: Industry standard for temporary secure access, no custom auth needed
- 1-hour expiration: Balances security (prevents URL sharing) with UX (allows page reloads)
- Access control: Server checks attendance status (verified participants only) before generating URL

**Alternatives Considered**:
- Direct S3 with signed URLs: More expensive egress costs
- Store photos in SQLite/local filesystem: Scalability issues, no CDN benefits
- Permanent public URLs with auth tokens: URLs could be shared, security risk
- Cloudflare Images: Higher cost, unnecessary transformations for this use case

**Implementation Notes**:
- Store R2 bucket, access key, secret in `src/env.ts` with Zod validation
- Photo upload: Admin uploads → store in R2 → save reference in `event_photos` table
- Access flow: User requests photo → server checks participant status = verified → generates pre-signed URL
- Use consistent key structure: `events/{eventId}/photos/{uuid}.{ext}`
- Optional: Cache URLs in `photo_access_urls` table with expiration for reuse within 1 hour

### 3. Participation Status State Machine

**Decision**: Four status values in participants table: `yes`, `no`, `maybe`, `verified`

**Rationale**:
- Participants are independent user-event mappings, not tied to tickets
- `yes`: User confirmed attendance (free event RSVP or ticket purchase complete)
- `no`: User explicitly declined
- `maybe`: User expressed interest but not committed
- `verified`: Ticket scanned at event (actual attendance confirmed)
- Status transitions: any → any (user can change mind), but `verified` is terminal (cannot be unset)
- Merges participation_status table into participants table (single source of truth)

**Alternatives Considered**:
- Separate participation_status table: Redundant, adds unnecessary complexity
- Boolean flags: Less expressive, harder to query participation summaries
- Additional statuses (waitlist, cancelled): Over-engineered for MVP

**Implementation Notes**:
- `participants` table: id, userId (FK to users), eventId (FK to events), status (enum: yes/no/maybe/verified), createdAt, updatedAt
- Unique constraint on (userId, eventId)
- Participants are normal system users (create user record if doesn't exist during RSVP)
- No phone number field needed (users already have email/contact info)
- Ticket scanning updates participant status to `verified`
- Query summaries: COUNT() grouped by status for organizer dashboard

### 4. Sales Period Configuration

**Decision**: Move `salesStartDate` and `salesEndDate` to `inventory_groups` table (NOT events table)

**Rationale**:
- Different inventory groups represent different ticket types (early bird, regular, VIP)
- Each inventory group can have its own sales window
- Early bird inventory: salesStart 4 months before event, salesEnd 2 months before
- Regular inventory: salesStart 2 months before, salesEnd 1 week before
- Inventory group already exists and owns products, natural place for period configuration

**Alternatives Considered**:
- Event-level sales period: Too rigid, doesn't support multi-tier pricing with different windows
- Product-level sales period: Products belong to inventory groups, redundant
- Separate `sales_periods` table: Over-normalized, adds unnecessary joins

**Implementation Notes**:
- Add `salesStartDate` and `salesEndDate` (nullable text, ISO 8601 UTC) to `inventory_groups`
- Validation: start < end, both within event date range if specified
- Purchase check: `WHERE CURRENT_TIMESTAMP BETWEEN salesStartDate AND salesEndDate`
- UI: Show countdown timer or "sales open on X" message based on inventory group dates
- Timezone handling: Store UTC, display local timezone

### 5. Free Events & Tickets

**Decision**: Add `isFree` boolean to `events` table ONLY (remove from ticket/product level)

**Rationale**:
- Event-level flag: Simplifies logic, entire event is free or paid (binary decision)
- No per-ticket free flag: Complicates checkout flow, confusing for users
- Free event flow: User clicks "RSVP" → creates participant record with status `yes` → optionally generates ticket
- Paid event flow: User clicks "Buy Ticket" → Stripe checkout → creates ticket + participant with status `yes`

**Alternatives Considered**:
- Price-based free detection (price === 0): Ambiguous, requires checking all products
- Product-level free flag: Allows mixing free/paid products, increases complexity unnecessarily
- Ticket-level free flag: Removed per user request - event nature (free vs paid) is binary

**Implementation Notes**:
- `events.isFree` boolean, default false
- Free event: Skip Stripe checkout, create participant with status `yes` directly
- Paid event: Participant created after successful payment
- Admin can still issue comp tickets for paid events (future enhancement if needed)

### 6. Participants as Independent Entities

**Decision**: Participants are user-event mappings, completely independent from tickets

**Rationale**:
- Free events: Users can RSVP without tickets
- Participation tracking: Interest signal separate from purchase/attendance
- User can indicate "maybe" before buying ticket
- Verified status: Set by ticket scanning, but participant exists independently
- Participants ARE normal system users: If user doesn't exist during RSVP, create user record

**Alternatives Considered**:
- Participants under tickets: Breaks for free events without tickets
- Separate participation_status table: Merged into participants table per user request
- Virtual table/view: Makes writes complex, prefer real table

**Implementation Notes**:
- `participants`: id, userId (FK to users.id), eventId (FK to events.id), status (enum), createdAt, updatedAt
- Unique constraint: (userId, eventId)
- Users table: Standard user fields (id, name, email) - participants reference existing users
- Create user flow: If email not in system during RSVP → create user record → create participant
- No phone field needed: Users are normal system users with standard contact fields
- Relationship: User → many participants, Event → many participants
- No direct FK to tickets (linked conceptually via userId + eventId)

### 7. Simplified Event Photos Schema

**Decision**: Single `event_photos` table with `key` field (S3 object key), no `size` or `difference` fields

**Rationale**:
- `key`: S3/R2 object key (e.g., `events/123/photo-{uuid}.jpg`), standard S3 terminology
- No `size` field: Not needed for MVP, can add later if storage optimization required
- No `difference` field: Replaced with `key` per user request - clearer naming
- File type in key extension: Simpler than separate MIME type field (though can add if needed)
- Thumbnail generation: Out of scope for MVP, R2 can serve originals

**Alternatives Considered**:
- Multiple size variants (thumbnail, medium, full): Premature optimization
- `difference` field name: User requested change to `key` - more standard
- Storing binary in SQLite: Poor performance, no CDN benefits
- Separate sizes table: Over-engineered for MVP

**Implementation Notes**:
- `event_photos`: id, eventId (FK), key (S3 object key), uploadedAt, uploadedBy (userId FK)
- Access control: Check if user has participant status = `verified` for event
- Pre-signed URL generation: Use R2 SDK with `getSignedUrl()`, 1-hour expiration
- Optional: Store `photo_access_urls` for caching (id, photoId, url, expiresAt) - can implement if performance needed
- Key structure: `events/{eventId}/photos/{uuid}.{ext}`

### 8. Concurrent Ticket Scanning Handling

### 8. Concurrent Ticket Scanning Handling

**Decision**: Database-level transaction with optimistic concurrency control

**Rationale**:
- SQLite/Drizzle supports transactions
- Prevents duplicate scans via atomicity
- First successful scan wins, subsequent attempts rejected
- Also update participant status to `verified` in same transaction

**Best Practices**:
- Use database transaction for scan operation
- Check `scannedAt IS NULL` on tickets before update
- Update both `tickets.scannedAt` AND `participants.status = verified` atomically
- If already scanned, return error with original scan time
- Display clear "Already Scanned" message with timestamp
- Log all scan attempts (successful + failed) for audit trail

**Implementation**:
```typescript
// Pseudo-code
db.transaction(() => {
  const ticket = db.select().where(qrCodeUuid = uuid AND scannedAt IS NULL)
  if (!ticket) return { error: "Already scanned or invalid" }
  db.update(tickets).set({ scannedAt: now() }).where(id = ticket.id)
  db.update(participants).set({ status: 'verified' }).where(userId = ticket.buyerId AND eventId = ticket.eventId)
  return { success: true }
})
```

### 9. Timezone Handling for Sales Period

**Decision**: Store UTC in database, display local timezone, validate server-side

**Rationale**:
- ISO 8601 strings in database (UTC) for inventory_groups.salesStartDate/salesEndDate
- Qwik's routeLoader runs on server (server timezone authoritative)
- Client displays in user's local timezone via date-fns (already installed)
- Prevents timezone confusion and ensures consistent validation

**Alternatives Considered**:
- Store user's local timezone: Complex, error-prone, unnecessary
- Client-side validation: Can be bypassed, server must be authoritative
- Timestamp integers: Less readable, ISO 8601 is standard

**Implementation Notes**:
- Store: `salesStartDate`, `salesEndDate` as ISO 8601 UTC strings
- Validate: Server-side comparison using Date objects in route actions
- Display: Use date-fns `format` or Qwik's date utilities for user's local timezone
- Admin UI: date picker with timezone indicator
- Edge case: Handle users in different timezones viewing same event - server time wins

## Technology Stack Confirmation

- **QR Codes**: `qrcode` npm package (generation), `html5-qrcode` library (scanning) - both already installed
- **Photo Storage**: Cloudflare R2 (S3-compatible)
- **URL Signing**: AWS SDK for JavaScript v3 (already installed, compatible with R2)
- **Database**: Drizzle ORM with SQLite/Turso
- **Validation**: Zod schemas for all inputs
- **UI Framework**: Qwik components with signals for reactive state
- **Date Handling**: date-fns (already installed 3.6.0)
- **Image Processing**: sharp (already installed) - optional for thumbnails

## Risk Assessment

### Technical Risks
- **Camera access**: Not all devices support getUserMedia (fallback: manual UUID entry)
- **R2 costs**: Monitor egress, though R2 has zero egress fees
- **Concurrent scans**: Lock mechanism on ticket update to prevent race conditions
- **Photo upload size**: Implement file size limits (e.g., 10MB per photo)
- **URL expiration UX**: Users may bookmark expired photo URLs

### Mitigation Strategies
- Progressive enhancement: QR scanner with manual input fallback
- Database transactions: Use Drizzle transactions for ticket scanning atomicity
- File validation: Check MIME type and size before R2 upload
- Rate limiting: Prevent abuse of URL generation endpoint
- Clear error messages: Guide users to regenerate expired photo URLs

## Open Questions (All Resolved)

All research questions have been resolved with the following key decisions:
1. ✅ Sales periods moved to inventory_groups table
2. ✅ Participants are independent user-event mappings
3. ✅ isFree only at event level (removed from ticket level)
4. ✅ participation_status merged into participants table
5. ✅ No phone field needed (participants are normal users)
6. ✅ Status values: yes, no, maybe, verified
7. ✅ event_photos simplified: key field instead of difference, no size field

Ready to proceed to Phase 1: Design & Contracts.
