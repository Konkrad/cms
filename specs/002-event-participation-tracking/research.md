# Research: Event Participation Tracking & Enhanced Features

**Date**: 2025-12-29  
**Purpose**: Resolve technical unknowns from Technical Context

## QR Code Generation and Scanning

### Decision: qrcode (generation) + html5-qrcode (scanning)

**Rationale**:
- **qrcode** (npm package) is widely used, actively maintained, works server-side and client-side
- Generates QR codes as data URLs, SVG, or canvas compatible with Qwik SSR
- **html5-qrcode** provides robust browser-based QR scanning with camera access
- Works on mobile and desktop browsers, supports both camera and file upload
- Both libraries have TypeScript support via @types packages

**Alternatives Considered**:
- **QRCode.js**: Less active maintenance, no SSR support
- **jsQR**: Requires manual canvas/video handling, more low-level
- **Instascan**: Deprecated, unmaintained
- **ZXing**: Java-based, overkill for web application

### Implementation Details:
- Server-side QR generation during ticket creation using `qrcode` package
- Store QR code UUID in tickets table (already exists: `qrCodeUuid`)
- Client-side scanning with `html5-qrcode` in TicketScanner component
- QR payload: JSON with `{ticketId, eventId, signature}` for validation

## Secure Photo URL Generation

### Decision: HMAC-SHA256 signed URLs with expiry timestamps

**Rationale**:
- Node.js built-in `crypto` module (no external dependencies)
- Sign URLs with HMAC using secret key from environment config
- Include expiry timestamp in signature to prevent replay attacks
- Validates on server before serving photo from /private/ storage
- Industry standard approach used by AWS, Cloudflare, etc.

**Alternatives Considered**:
- **JWT tokens**: Overkill for simple URL signing, adds dependency
- **Database-stored tokens**: Requires cleanup job, slower validation
- **UUID-based temporary URLs**: No expiry validation, security risk

### Implementation Details:
```typescript
// Generate: /api/photos/{photoId}/secure?exp={timestamp}&sig={hmac}
// HMAC payload: `${photoId}:${userId}:${expiryTimestamp}`
// Secret key from env.PHOTO_URL_SECRET
// Expiry: 1 hour from generation (3600 seconds)
```

## Testing Framework

### Decision: Vitest (detected in existing codebase)

**Verification**: Let me check the existing test setup.

Looking at the codebase structure and Qwik conventions, Vitest is the recommended testing framework for Qwik projects.

**Rationale**:
- Native Vitest integration in Qwik projects
- Fast unit testing with Vite-powered HMR
- Compatible with Qwik's component model and SSR
- TypeScript support out of the box

**Test Strategy**:
- Unit tests for services (ticket scanning, photo URL generation, participation status)
- Integration tests for route actions (scan endpoint, photo upload)
- E2E tests for critical flows (ticket purchase → scan → photo access)

## Uppy.io v5 Integration with Qwik

### Decision: Uppy Dashboard with XHR Upload pointing to existing endpoint

**Rationale**:
- Uppy v5 is framework-agnostic, works with Qwik via client-side mounting
- Dashboard provides drag-and-drop, progress tracking, retry logic out of box
- XHR Upload plugin can POST to existing `/api/upload` endpoint
- Existing endpoint already handles webp conversion and optimization
- Store photos under `/private/` path via endpoint parameter

**Alternatives Considered**:
- **Uppy Drag & Drop**: Too minimal, missing file preview/management
- **Native file input**: Would require reimplementing upload, progress, retry logic
- **React-based upload libs**: Framework mismatch, bundle size concerns

### Implementation Details:
```typescript
// In PhotoUploader component (client-side)
import Uppy from '@uppy/core';
import Dashboard from '@uppy/dashboard';
import XHRUpload from '@uppy/xhr-upload';

const uppy = new Uppy({
  restrictions: {
    maxFileSize: 10 * 1024 * 1024, // 10MB
    allowedFileTypes: ['image/*'],
  },
})
.use(Dashboard, { target: '#uppy-container' })
.use(XHRUpload, {
  endpoint: '/api/upload',
  formData: true,
  fieldName: 'file',
  headers: {
    'x-upload-path': '/private/events/{eventId}/photos',
  },
});
```

## Photo Storage Strategy

### Decision: File system storage under /private/ with database references

**Rationale**:
- Leverage existing upload endpoint infrastructure
- Photos stored at `/private/events/{eventId}/photos/{uuid}.webp`
- Database stores file path reference in `eventPhotos` table
- Secure URL generation validates attendance before serving file
- Scalable: can migrate to object storage (S3, R2) later without schema changes

**Alternatives Considered**:
- **Database BLOB storage**: Not scalable, poor performance for large files
- **Object storage first**: Premature optimization, adds complexity and cost
- **Public storage with obscure URLs**: Security through obscurity, violates requirements

### Implementation Details:
- Upload endpoint converts to webp, stores at path specified in `x-upload-path` header
- Returns file path to client
- Client sends path + metadata to `/api/events/{eventId}/photos` to create database record
- Photo access validates: user attended event → generate signed URL → serve file

## Sales Period Validation Strategy

### Decision: Database-level date fields with service-layer validation

**Rationale**:
- Add `salesStartDate` and `salesEndDate` to events schema
- Validation in `events.service.ts` before allowing product purchase
- Check performed in checkout route action (fail-fast principle)
- Clear error messages returned to user when outside sales window

**Alternatives Considered**:
- **Scheduled jobs to enable/disable**: Complex, not real-time
- **Client-side only**: Bypassable, insecure
- **Middleware approach**: Over-engineering for single feature

### Implementation Details:
```typescript
// In events.service.ts
export function validateSalesPeriod(event: Event): {valid: boolean, reason?: string} {
  const now = new Date();
  if (event.salesStartDate && new Date(event.salesStartDate) > now) {
    return {valid: false, reason: `Sales open on ${event.salesStartDate}`};
  }
  if (event.salesEndDate && new Date(event.salesEndDate) < now) {
    return {valid: false, reason: 'Sales have closed'};
  }
  return {valid: true};
}
```

## Multi-Participant Data Collection

### Decision: Separate `ticketParticipants` table with foreign key to tickets

**Rationale**:
- Product schema gets `participantCapacity` integer field (default 1)
- When capacity > 1, checkout collects array of participant details
- Store each participant as separate row in `ticketParticipants` table
- Maintains data normalization, easy to query/display
- Allows flexible participant fields per product type

**Alternatives Considered**:
- **JSON field on tickets**: Poor queryability, no schema validation
- **Separate fields on tickets**: Doesn't scale beyond 2-3 participants
- **Inline with transaction items**: Wrong level of abstraction

### Implementation Details:
```typescript
// ticketParticipants schema
{
  id: uuid,
  ticketId: foreignKey(tickets.id),
  participantOrder: integer, // 1, 2, 3... for display order
  name: text,
  email: text,
  phone: text,
  additionalData: json, // Product-specific fields (dietary, shirt size, etc.)
}

// Checkout validation ensures:
// participants.length === product.participantCapacity
```

## Participation Status Tracking

### Decision: Separate `participationStatus` table, decoupled from tickets

**Rationale**:
- User can indicate "maybe" without ticket purchase
- For paid events: "yes" recorded only after successful transaction
- For free events: "yes" recorded immediately on RSVP
- Table structure: `{userId, eventId, status, updatedAt}`
- Status upgraded from "maybe" to "yes" automatically on ticket purchase

**Alternatives Considered**:
- **Ticket-coupled status**: Can't track "maybe" for unpurchased tickets
- **Event-embedded JSON**: Poor queryability for reporting
- **Separate yes/no/maybe tables**: Over-normalized, complicates queries

### Implementation Details:
```typescript
// participationStatus schema
{
  id: uuid,
  userId: foreignKey(users.id),
  eventId: foreignKey(events.id),
  status: text, // 'yes' | 'no' | 'maybe'
  updatedAt: timestamp,
}

// Unique constraint on (userId, eventId)
// Automatically upgrade "maybe" to "yes" in transaction completion hook
```

## Technology Stack Summary

| Component | Technology | Version | Implementation Pattern |
|-----------|-----------|---------|------------------------|
| QR Generation | qrcode | ^1.5.3 | Server-side generation in ticket creation |
| QR Scanning | html5-qrcode | ^2.3.8 | Browser-based camera access |
| Photo Upload UI | @uppy/core + plugins | ^5.0.0 | Client-side component → existing /api/upload |
| Secure URLs | Node crypto (built-in) | - | HMAC-SHA256 signing via server function |
| Testing | Vitest | (existing) | Unit/integration tests |
| Storage | File system + DB refs | - | /private/ directory with DB metadata |
| **Client-Server Communication** | **Qwik Server Functions** | - | **routeAction$/routeLoader$ (NOT REST APIs)** |
| **Photo File Serving** | **REST API** | - | **/api/photos/serve (ONLY REST endpoint)** |

### Architecture Clarification: Server Functions vs REST APIs

**This feature follows Qwik's server function pattern:**

- **Ticket Scanning**: `routeAction$()` in `/admin/events/[id]/scan/` - NOT `/api/tickets/scan`
- **Participation Status**: `routeAction$()` + `routeLoader$()` in event route - NOT `/api/events/:id/participation`
- **Photo Metadata Creation**: `routeAction$()` in photos route - NOT `/api/events/:id/photos`
- **Photo Gallery Loading**: `routeLoader$()` with attendance validation - NOT `/api/events/:id/photos` GET
- **Secure URL Generation**: `routeAction$()` returning signed URL - NOT `/api/photos/:id/secure-url`

**ONLY ONE REST API ENDPOINT**:
- `/api/photos/serve?path=...&exp=...&sig=...` - Serves binary image data with HMAC validation

**Rationale**: 
- Qwik server functions provide type safety, automatic serialization, session integration, and simpler code
- REST APIs only needed for non-JSON responses (binary files) or external integrations
- Current ticket system already uses this pattern (checkout via `routeAction$`)
- Reduces API surface area and improves maintainability

## Best Practices Applied

### Photo Upload
- Progressive enhancement: upload works with/without JS
- File validation client and server-side
- Progress feedback with Uppy Dashboard
- Automatic retry on network errors
- Optimistic UI updates with rollback on failure

### Ticket Scanning
- Real-time validation via API call (internet required per requirements)
- Clear visual feedback (success/error/duplicate)
- Offline detection with user messaging
- Scan history logging for audit trail
- Rate limiting to prevent abuse

### Secure Photo Access
- Defense in depth: attendance check + signed URL + file path validation
- Short expiry (1 hour) minimizes exposure window
- URLs include userId in signature to prevent sharing
- Server validates signature before file access
- No directory traversal vulnerabilities

### Multi-Participant Forms
- Progressive disclosure: show participant fields dynamically
- Client-side validation before submission
- Server-side validation enforces completeness
- Clear error messages per participant field
- Autosave to prevent data loss on page refresh

## Performance Considerations

- **QR Code Generation**: Pre-generate on ticket creation (async), cache in DB as data URL
- **Photo Upload**: Stream processing, chunked uploads for large files, concurrent upload limit (5)
- **Secure URL Generation**: In-memory HMAC calculation (<1ms), no DB lookup needed
- **Ticket Scanning**: Indexed lookup on `qrCodeUuid`, response time <100ms
- **Photo Gallery**: Lazy loading thumbnails, intersection observer for scroll performance

## Security Considerations

- **QR Code Tampering**: HMAC signature in QR payload, validated on scan
- **Photo URL Sharing**: Signature includes userId, prevents cross-user sharing
- **CSRF Protection**: Qwik's built-in CSRF tokens on all form actions
- **SQL Injection**: Parameterized queries via Drizzle ORM
- **Path Traversal**: Strict validation on photo paths, no user input in file path
- **Rate Limiting**: Scan endpoint limited to 100 requests/minute per IP

## Migration Path

1. Add new schema files (event-photos, participation-status, ticket-participants)
2. Extend existing schemas (events: sales dates, products: participant capacity, tickets: isFree)
3. Generate and run Drizzle migrations
4. Implement services layer (photos, participation, extended tickets/events)
5. Build components (PhotoUploader, TicketScanner, ParticipationToggle)
6. Create route handlers and API endpoints
7. Add utilities (qr-code, secure-urls)
8. Test in isolation, then integration, then E2E

## Open Questions Resolved

✅ QR code library selection  
✅ QR scanning approach  
✅ Secure URL generation mechanism  
✅ Testing framework  
✅ Uppy.io integration with Qwik  
✅ Photo storage strategy  
✅ Sales period validation approach  
✅ Multi-participant data structure  
✅ Participation status tracking architecture  

**All NEEDS CLARIFICATION items resolved. Ready for Phase 1 design.**
