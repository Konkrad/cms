# Server Function Contracts: Ticket Scanning

**Implementation**: Qwik server functions in route files (NOT REST APIs)

## scanTicketAction

**Location**: `src/routes/admin/events/[id]/scan/index.tsx`  
**Type**: `routeAction$()` with `zod$()` validation

### Input Schema (Zod)

```typescript
{
  qrData: z.string().min(1),
  eventId: z.string().uuid(),
}
```

**Validation**:
- `qrData`: Must be valid JSON containing `{ticketId, eventId, signature}`
- `eventId`: Must match the eventId in qrData and route parameter
- Current user must be event organizer (event.userId)
- QR signature must validate using HMAC-SHA256

### Return Type

**Success (first scan)**:
```typescript
{
  success: true,
  ticketId: string,
  buyerName: string,
  scannedAt: string, // ISO 8601
  isFirstScan: true
}
```

**Success (already scanned)**:
```typescript
{
  success: true,
  ticketId: string,
  buyerName: string,
  scannedAt: string, // Original scan timestamp
  isFirstScan: false
}
```

**Error**:
```typescript
{
  success: false,
  error: string // "Invalid QR code signature" | "Ticket not found" | "Not authorized"
}
```

---

## getTicketDetailsLoader

**Location**: `src/routes/profile/tickets/[ticketId]/index.tsx`  
**Type**: `routeLoader$()`

### Input

- Route parameter: `ticketId` (UUID)
- Session: Current user must own ticket or be event organizer

### Return Type

```typescript
{
  id: string,
  qrCodeUuid: string,
  eventId: string,
  eventTitle: string,
  productName: string,
  buyerName: string,
  isFree: boolean,
  scannedAt: string | null, // ISO 8601
  createdAt: string,
  participants: Array<{
    participantOrder: number,
    name: string,
    email: string,
    phone: string | null
  }>
}
```

**Error**: Throws Qwik error (404 if not found, 403 if not authorized)
