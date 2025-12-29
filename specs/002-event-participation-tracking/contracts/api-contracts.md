# API Contracts: Event Participation Tracking

**Feature**: 002-event-participation-tracking  
**Date**: 2025-12-29  
**Phase**: 1 - Design

This document defines the API contracts for participation tracking, ticket scanning, and photo management endpoints.

---

## Participants API

### POST /api/events/:eventId/participants

Create or update participation status for a user.

**Path Parameters**:
- `eventId` (string, UUID) - Event ID

**Request Body**:
```typescript
{
  status: "yes" | "no" | "maybe"  // Cannot set "verified" manually
}
```

**Response** (200 OK):
```typescript
{
  success: true,
  data: {
    id: string,           // UUID
    userId: string,       // UUID
    eventId: string,      // UUID
    status: "yes" | "no" | "maybe" | "verified",
    createdAt: string,    // ISO 8601
    updatedAt: string     // ISO 8601
  }
}
```

**Error Responses**:
- 400 Bad Request: Invalid status value
- 401 Unauthorized: User not authenticated
- 404 Not Found: Event does not exist
- 409 Conflict: Cannot change status from "verified"

---

### GET /api/events/:eventId/participants

Get participation summary for an event (organizers only).

**Path Parameters**:
- `eventId` (string, UUID) - Event ID

**Query Parameters**:
- `detailed` (boolean, optional) - Include individual participant details (default: false)

**Response** (200 OK):
```typescript
{
  success: true,
  data: {
    summary: {
      yes: number,      // Count of confirmed participants
      no: number,       // Count of declined
      maybe: number,    // Count of interested
      verified: number  // Count of scanned attendees
    },
    participants?: Array<{  // Only if detailed=true
      id: string,
      userId: string,
      userName: string,
      userEmail: string,
      status: "yes" | "no" | "maybe" | "verified",
      updatedAt: string
    }>
  }
}
```

**Error Responses**:
- 401 Unauthorized: User not authenticated
- 403 Forbidden: User is not event organizer
- 404 Not Found: Event does not exist

---

### GET /api/events/:eventId/participants/me

Get current user's participation status for an event.

**Path Parameters**:
- `eventId` (string, UUID) - Event ID

**Response** (200 OK):
```typescript
{
  success: true,
  data: {
    status: "yes" | "no" | "maybe" | "verified" | null,  // null if not participating
    updatedAt: string | null
  }
}
```

**Error Responses**:
- 401 Unauthorized: User not authenticated
- 404 Not Found: Event does not exist

---

## Ticket Scanning API

### POST /api/tickets/scan

Scan a ticket QR code and mark attendance (extends existing endpoint).

**Request Body**:
```typescript
{
  qrCodeUuid: string  // UUID from QR code
}
```

**Response** (200 OK):
```typescript
{
  success: true,
  data: {
    ticket: {
      id: string,
      eventId: string,
      eventTitle: string,
      buyerId: string,
      buyerName: string,
      buyerEmail: string,
      productName: string,
      scannedAt: string  // ISO 8601 timestamp of this scan
    },
    participant: {
      status: "verified",  // Updated to verified
      updatedAt: string
    }
  }
}
```

**Error Responses**:
- 400 Bad Request: Invalid QR code format
- 404 Not Found: Ticket does not exist
- 409 Conflict: Ticket already scanned
  ```typescript
  {
    success: false,
    error: "Ticket already scanned",
    data: {
      scannedAt: string,  // Original scan timestamp
      buyerName: string
    }
  }
  ```

---

## Event Photos API

### POST /api/events/:eventId/photos

Upload photos for an event (organizers only).

**Path Parameters**:
- `eventId` (string, UUID) - Event ID

**Request Body** (multipart/form-data):
```typescript
{
  files: File[]  // Image files (jpg, jpeg, png, heic, webp)
}
```

**Response** (201 Created):
```typescript
{
  success: true,
  data: {
    uploaded: Array<{
      id: string,
      key: string,
      uploadedAt: string
    }>,
    failed: Array<{
      filename: string,
      error: string
    }>
  }
}
```

**Error Responses**:
- 400 Bad Request: Invalid file format or size
- 401 Unauthorized: User not authenticated
- 403 Forbidden: User is not event organizer
- 404 Not Found: Event does not exist
- 413 Payload Too Large: File exceeds 10MB limit

---

### GET /api/events/:eventId/photos

List photos for an event (verified attendees only).

**Path Parameters**:
- `eventId` (string, UUID) - Event ID

**Query Parameters**:
- `cursor` (string, optional) - Pagination cursor
- `limit` (number, optional) - Results per page (default: 50, max: 100)

**Response** (200 OK):
```typescript
{
  success: true,
  data: {
    photos: Array<{
      id: string,
      url: string,        // Pre-signed URL (1 hour expiration)
      uploadedAt: string
    }>,
    pagination: {
      nextCursor: string | null,
      hasMore: boolean
    }
  }
}
```

**Error Responses**:
- 401 Unauthorized: User not authenticated
- 403 Forbidden: User did not attend event (no verified participant record)
- 404 Not Found: Event does not exist

---

### DELETE /api/events/:eventId/photos/:photoId

Delete a photo (organizers only).

**Path Parameters**:
- `eventId` (string, UUID) - Event ID
- `photoId` (string, UUID) - Photo ID

**Response** (200 OK):
```typescript
{
  success: true,
  data: {
    deleted: true
  }
}
```

**Error Responses**:
- 401 Unauthorized: User not authenticated
- 403 Forbidden: User is not event organizer
- 404 Not Found: Photo or event does not exist

---

## Sales Period Validation (Client-Side Check)

No dedicated endpoint - sales period validation happens in existing product/checkout endpoints.

**Behavior Changes**:
- GET /api/events/:eventId/products - Include `isAvailable` flag based on inventory group sales period
- POST /api/checkout - Validate sales period server-side before creating transaction

**Example Product Response** (modified):
```typescript
{
  success: true,
  data: {
    products: Array<{
      id: string,
      name: string,
      price: number,
      inventoryGroupName: string,
      salesStartDate: string | null,  // ISO 8601
      salesEndDate: string | null,    // ISO 8601
      isAvailable: boolean,           // Computed based on current time
      availabilityMessage: string     // e.g., "Sales open Dec 25" or "Sales closed"
    }>
  }
}
```

---

## Zod Validation Schemas

These schemas validate API inputs following constitution patterns.

### Participants

```typescript
import { z } from "zod";

export const participantStatusSchema = z.enum(["yes", "no", "maybe", "verified"]);

export const createParticipantSchema = z.object({
  status: z.enum(["yes", "no", "maybe"]),  // Cannot set verified via API
});

export const participantResponseSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  eventId: z.string().uuid(),
  status: participantStatusSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
```

### Ticket Scanning

```typescript
export const scanTicketSchema = z.object({
  qrCodeUuid: z.string().uuid(),
});

export const scanTicketResponseSchema = z.object({
  ticket: z.object({
    id: z.string().uuid(),
    eventId: z.string().uuid(),
    eventTitle: z.string(),
    buyerId: z.string().uuid(),
    buyerName: z.string(),
    buyerEmail: z.string().email(),
    productName: z.string(),
    scannedAt: z.string().datetime(),
  }),
  participant: z.object({
    status: z.literal("verified"),
    updatedAt: z.string().datetime(),
  }),
});
```

### Event Photos

```typescript
export const uploadPhotosSchema = z.object({
  files: z.array(z.instanceof(File))
    .min(1, "At least one file required")
    .max(50, "Maximum 50 files per upload"),
});

export const photoResponseSchema = z.object({
  id: z.string().uuid(),
  key: z.string(),
  url: z.string().url().optional(),  // Only included when generating URLs
  uploadedAt: z.string().datetime(),
});

export const listPhotosQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.number().int().min(1).max(100).default(50),
});
```

---

## Error Response Format

All endpoints follow this standard error format:

```typescript
{
  success: false,
  error: string,        // Human-readable error message
  details?: object      // Optional additional error context
}
```

**HTTP Status Codes**:
- 200 OK: Success
- 201 Created: Resource created
- 400 Bad Request: Invalid input
- 401 Unauthorized: Authentication required
- 403 Forbidden: Insufficient permissions
- 404 Not Found: Resource does not exist
- 409 Conflict: State conflict (e.g., already scanned)
- 413 Payload Too Large: File too large
- 500 Internal Server Error: Unexpected error

---

## Authentication

All endpoints require authentication via session cookie (existing mechanism).

**Headers**:
- `Cookie: session=<session-token>` (existing)

**Unauthorized Response** (401):
```typescript
{
  success: false,
  error: "Authentication required"
}
```

---

## Rate Limiting

**Photo Upload**: 10 requests per minute per user  
**Ticket Scanning**: 100 requests per minute per user  
**Participants API**: 30 requests per minute per user

Rate limit exceeded response (429):
```typescript
{
  success: false,
  error: "Rate limit exceeded",
  details: {
    retryAfter: number  // Seconds until limit resets
  }
}
```

---

## Testing Checklist

### Participants API
- ✅ Create new participant with status "yes"
- ✅ Update existing participant status
- ✅ Prevent manual setting of "verified" status
- ✅ Prevent changing status from "verified"
- ✅ Get participation summary (organizer only)
- ✅ Get current user's status

### Ticket Scanning API
- ✅ Scan valid ticket (first time)
- ✅ Reject already-scanned ticket with original timestamp
- ✅ Update participant status to "verified" on scan
- ✅ Validate QR code format
- ✅ Return ticket and buyer details

### Event Photos API
- ✅ Upload photos (organizer only)
- ✅ Reject non-image files
- ✅ Reject files >10MB
- ✅ List photos (verified attendees only)
- ✅ Generate pre-signed URLs
- ✅ Paginate photo lists
- ✅ Delete photo (organizer only)
- ✅ Deny access to non-attendees

---

## Security Considerations

### Access Control
- Photos: Check `participants.status = 'verified'` before generating URLs
- Upload: Check user is event organizer
- Scanning: Validate ticket belongs to event
- Participants: Any authenticated user can RSVP

### Input Validation
- All inputs validated via Zod schemas
- File type whitelist for photos
- UUIDs validated via regex
- Status enum enforced

### Data Exposure
- Photo URLs expire after 1 hour
- Organizer-only endpoints check ownership
- User details limited to organizers
- QR codes only valid for their event

---

## Migration from Existing System

### Ticket Scanning
- Existing `/api/tickets/scan` endpoint extended
- New response includes `participant` object
- Backwards compatible: old clients ignore new fields

### Products API
- Existing product endpoints add `isAvailable` flag
- Computed server-side from inventory group sales period
- Backwards compatible: flag optional for old clients

---

## Future Enhancements (Not in MVP)

- Batch ticket scanning (scan multiple at once)
- Photo album organization (group photos)
- Photo reactions/comments from attendees
- Push notifications for participation updates
- Calendar integration for event RSVPs
- Complimentary ticket issuance for paid events
