# API Contracts: Participation Status

**Base Path**: `/api/participation`

## POST /api/events/:eventId/participation

Update user's participation status for an event.

### Request

**Path Parameters**:
- `eventId`: string (UUID, required)

**Headers**:
```
Content-Type: application/json
Authorization: Bearer <token>
```

**Body**:
```json
{
  "status": "yes" | "no" | "maybe"
}
```

**Validation**:
- `status` must be exactly 'yes', 'no', or 'maybe'
- For paid events: 'yes' only allowed if user has purchased ticket
- For free events: 'yes' creates free ticket automatically

### Response

**Success (200)**:
```json
{
  "success": true,
  "data": {
    "userId": "string (UUID)",
    "eventId": "string (UUID)",
    "status": "yes" | "no" | "maybe",
    "updatedAt": "string (ISO 8601)"
  }
}
```

**Error (400)**: Cannot set 'yes' for paid event without ticket
```json
{
  "success": false,
  "error": "Cannot indicate 'yes' for paid event without ticket purchase"
}
```

---

## GET /api/events/:eventId/participation

Get participation status for current user.

### Request

**Path Parameters**:
- `eventId`: string (UUID, required)

**Headers**:
```
Authorization: Bearer <token>
```

### Response

**Success (200)**: Status exists
```json
{
  "success": true,
  "data": {
    "status": "yes" | "no" | "maybe",
    "updatedAt": "string (ISO 8601)"
  }
}
```

**Success (200)**: No status set
```json
{
  "success": true,
  "data": null
}
```

---

## GET /api/events/:eventId/participation/summary

Get participation summary for event (organizer only).

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
    "yes": 45,
    "no": 12,
    "maybe": 23,
    "total": 80
  }
}
```

**Error (403)**:
```json
{
  "success": false,
  "error": "Only event organizer can view participation summary"
}
```
