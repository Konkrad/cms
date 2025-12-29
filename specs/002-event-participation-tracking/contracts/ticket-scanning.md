# API Contract: Ticket Scanning

**Endpoint**: POST `/api/events/{eventId}/scan`  
**Purpose**: Validate and mark ticket as scanned, update participant status to verified

## Request

### Path Parameters
- `eventId` (string, UUID): Event identifier

### Body (JSON)
```json
{
  "qrCodeUuid": "string (UUID, required)"
}
```

### Headers
```
Authorization: Bearer <token>
Content-Type: application/json
```

### Validation Rules
- `qrCodeUuid`: Must be valid UUID format
- User must be event organizer or have scanning permissions
- Event must exist

## Response

### Success (200 OK)
```json
{
  "success": true,
  "data": {
    "ticket": {
      "id": "string (UUID)",
      "qrCodeUuid": "string (UUID)",
      "eventId": "string (UUID)",
      "buyerId": "string (UUID)",
      "scannedAt": "string (ISO 8601)"
    },
    "attendee": {
      "id": "string (UUID)",
      "name": "string",
      "email": "string"
    },
    "participant": {
      "id": "string (UUID)",
      "status": "verified"
    }
  },
  "message": "Ticket scanned successfully"
}
```

### Error Responses

#### 400 Bad Request - Invalid QR Code
```json
{
  "success": false,
  "error": "Invalid QR code format"
}
```

#### 404 Not Found - Ticket Doesn't Exist
```json
{
  "success": false,
  "error": "Ticket not found"
}
```

#### 409 Conflict - Already Scanned
```json
{
  "success": false,
  "error": "Ticket already scanned",
  "data": {
    "scannedAt": "string (ISO 8601)",
    "attendeeName": "string"
  }
}
```

#### 403 Forbidden - Wrong Event
```json
{
  "success": false,
  "error": "Ticket does not belong to this event"
}
```

#### 401 Unauthorized
```json
{
  "success": false,
  "error": "Unauthorized"
}
```

## Business Logic

1. **Validation**:
   - Parse and validate UUID format
   - Query ticket by qrCodeUuid
   - Verify ticket exists and belongs to specified event
   - Check scannedAt is NULL

2. **Transaction** (atomic operation):
   - Update `tickets.scannedAt = CURRENT_TIMESTAMP`
   - Upsert participant: `status = 'verified'` for `(userId = ticket.buyerId, eventId)`
   - Log scan attempt in audit table (optional)

3. **Response**:
   - Fetch attendee details (name, email)
   - Return ticket + attendee + participant info
   - Include timestamp for client display

## Rate Limiting
- 100 requests per minute per IP
- 500 requests per minute per organizer account

## Notes
- Idempotent: Multiple scans of same ticket return 409 with original scan time
- Transaction ensures ticket scan and participant verification happen atomically
- Fallback: Manual entry if camera unavailable (same endpoint)
