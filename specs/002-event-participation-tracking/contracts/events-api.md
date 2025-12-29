# API Contracts: Event Extensions

**Base Path**: `/api/events`

## PATCH /api/events/:eventId

Update event including sales period fields.

### Request

**Path Parameters**:
- `eventId`: string (UUID, required)

**Headers**:
```
Content-Type: application/json
Authorization: Bearer <token>
```

**Body** (all fields optional):
```json
{
  "title": "string",
  "body": "string",
  "startDate": "string (ISO 8601)",
  "endDate": "string (ISO 8601)",
  "salesStartDate": "string (ISO 8601) or null",
  "salesEndDate": "string (ISO 8601) or null",
  "locationType": "physical" | "online" | "hybrid",
  "address": "string",
  "city": "string",
  "country": "string",
  "onlineUrl": "string"
}
```

**Validation**:
- User must be event organizer (event.userId)
- If `salesStartDate` set: must be before `salesEndDate`
- If `salesEndDate` set: must be before or equal to `endDate`
- Cannot change dates if tickets already sold (business rule)

### Response

**Success (200)**:
```json
{
  "success": true,
  "data": {
    "id": "string (UUID)",
    "title": "string",
    "salesStartDate": "string (ISO 8601) or null",
    "salesEndDate": "string (ISO 8601) or null",
    "updatedAt": "string (ISO 8601)"
  }
}
```

**Error (400)**: Invalid sales period
```json
{
  "success": false,
  "error": "Sales end date must be before event end date"
}
```

**Error (403)**:
```json
{
  "success": false,
  "error": "Only event organizer can update event"
}
```

---

## GET /api/events/:eventId/sales-status

Check if event is currently accepting ticket sales.

### Request

**Path Parameters**:
- `eventId`: string (UUID, required)

### Response

**Success (200)**: Sales active
```json
{
  "success": true,
  "data": {
    "salesActive": true,
    "salesStartDate": "string (ISO 8601) or null",
    "salesEndDate": "string (ISO 8601) or null"
  }
}
```

**Success (200)**: Sales not yet started
```json
{
  "success": true,
  "data": {
    "salesActive": false,
    "reason": "Sales open on 2025-01-15T10:00:00Z",
    "salesStartDate": "string (ISO 8601)",
    "salesEndDate": "string (ISO 8601) or null"
  }
}
```

**Success (200)**: Sales closed
```json
{
  "success": true,
  "data": {
    "salesActive": false,
    "reason": "Sales have closed",
    "salesStartDate": "string (ISO 8601) or null",
    "salesEndDate": "string (ISO 8601)"
  }
}
```

---

## GET /api/events/:eventId/stats

Get event statistics (organizer only).

### Request

**Path Parameters**:
- `eventId`: string (UUID, required)

**Headers**:
```
Authorization: Bearer <token>
```

**Authorization**:
- User must be event organizer (event.userId)

### Response

**Success (200)**:
```json
{
  "success": true,
  "data": {
    "totalTickets": 150,
    "freeTickets": 10,
    "paidTickets": 140,
    "attendedCount": 120,
    "attendanceRate": 80.0,
    "participationYes": 140,
    "participationMaybe": 25,
    "participationNo": 8,
    "totalPhotos": 87
  }
}
```

**Error (403)**:
```json
{
  "success": false,
  "error": "Only event organizer can view statistics"
}
```
