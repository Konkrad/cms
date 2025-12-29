# API Contracts: Ticket Scanning

**Base Path**: `/api/tickets`

## POST /api/tickets/scan

Scan a ticket QR code to mark attendance.

### Request

**Headers**:
```
Content-Type: application/json
```

**Body**:
```json
{
  "qrData": "string (required)",
  "eventId": "string (required, UUID)",
  "scannedBy": "string (required, UUID - organizer userId)"
}
```

**Validation**:
- `qrData`: Must be valid JSON containing `{ticketId, eventId, signature}`
- `eventId`: Must match the eventId in qrData
- `scannedBy`: Must be the event organizer (event.userId)
- QR signature must validate using HMAC-SHA256

### Response

**Success (200)**:
```json
{
  "success": true,
  "data": {
    "ticketId": "string (UUID)",
    "buyerName": "string",
    "scannedAt": "string (ISO 8601 timestamp)",
    "isFirstScan": true
  }
}
```

**Already Scanned (200)**:
```json
{
  "success": true,
  "data": {
    "ticketId": "string (UUID)",
    "buyerName": "string",
    "scannedAt": "string (original scan timestamp)",
    "isFirstScan": false
  }
}
```

**Error (400)**: Invalid QR code
```json
{
  "success": false,
  "error": "Invalid QR code signature"
}
```

**Error (404)**: Ticket not found
```json
{
  "success": false,
  "error": "Ticket not found"
}
```

**Error (403)**: Not authorized
```json
{
  "success": false,
  "error": "Only event organizer can scan tickets"
}
```

---

## GET /api/tickets/:ticketId

Get ticket details including participants.

### Request

**Path Parameters**:
- `ticketId`: string (UUID, required)

**Headers**:
```
Authorization: Bearer <token>
```

### Response

**Success (200)**:
```json
{
  "success": true,
  "data": {
    "id": "string (UUID)",
    "qrCodeUuid": "string (UUID)",
    "eventId": "string (UUID)",
    "eventTitle": "string",
    "productName": "string",
    "buyerName": "string",
    "isFree": false,
    "scannedAt": "string (ISO 8601) or null",
    "createdAt": "string (ISO 8601)",
    "participants": [
      {
        "participantOrder": 1,
        "name": "string",
        "email": "string",
        "phone": "string or null"
      }
    ]
  }
}
```

**Error (404)**:
```json
{
  "success": false,
  "error": "Ticket not found"
}
```

**Error (403)**:
```json
{
  "success": false,
  "error": "Not authorized to view this ticket"
}
```
