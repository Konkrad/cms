# API Contracts: Photo Management

**Base Path**: `/api/photos`

## POST /api/events/:eventId/photos

Create photo record after upload.

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
  "filePath": "string (required)",
  "thumbnailPath": "string (optional)"
}
```

**Validation**:
- User must be event organizer (event.userId)
- `filePath` must start with `/private/events/`
- `filePath` must end with `.webp`
- Event must have started (startDate <= now)

### Response

**Success (201)**:
```json
{
  "success": true,
  "data": {
    "id": "string (UUID)",
    "eventId": "string (UUID)",
    "filePath": "string",
    "thumbnailPath": "string or null",
    "uploadedAt": "string (ISO 8601)"
  }
}
```

**Error (403)**:
```json
{
  "success": false,
  "error": "Only event organizer can upload photos"
}
```

**Error (400)**:
```json
{
  "success": false,
  "error": "Cannot upload photos for events that haven't started"
}
```

---

## GET /api/events/:eventId/photos

List photos for an event (attendees only).

### Request

**Path Parameters**:
- `eventId`: string (UUID, required)

**Headers**:
```
Authorization: Bearer <token>
```

**Query Parameters**:
- `page`: number (optional, default 1)
- `limit`: number (optional, default 20, max 100)

**Authorization**:
- User must have attended the event (scannedAt IS NOT NULL)

### Response

**Success (200)**:
```json
{
  "success": true,
  "data": {
    "photos": [
      {
        "id": "string (UUID)",
        "thumbnailPath": "string or null",
        "uploadedAt": "string (ISO 8601)"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 150
    }
  }
}
```

**Error (403)**:
```json
{
  "success": false,
  "error": "Only attendees can view event photos"
}
```

---

## GET /api/photos/:photoId/secure-url

Generate time-limited secure URL for photo access.

### Request

**Path Parameters**:
- `photoId`: string (UUID, required)

**Headers**:
```
Authorization: Bearer <token>
```

**Authorization**:
- User must have attended the event associated with the photo

### Response

**Success (200)**:
```json
{
  "success": true,
  "data": {
    "url": "string",
    "expiresAt": "string (ISO 8601, now + 1 hour)"
  }
}
```

**Error (403)**:
```json
{
  "success": false,
  "error": "Not authorized to access this photo"
}
```

**Error (404)**:
```json
{
  "success": false,
  "error": "Photo not found"
}
```

---

## GET /api/photos/serve

Serve photo file with signed URL validation.

### Request

**Query Parameters**:
- `path`: string (required, file path)
- `exp`: string (required, expiry timestamp)
- `sig`: string (required, HMAC signature)

### Response

**Success (200)**:
```
Content-Type: image/webp
Cache-Control: public, max-age=3600

<binary image data>
```

**Error (403)**:
```json
{
  "success": false,
  "error": "Invalid or expired signature"
}
```

**Error (404)**:
```json
{
  "success": false,
  "error": "Photo not found"
}
```

---

## POST /api/upload

**NOTE**: This is an EXISTING endpoint. Documentation for reference.

Upload photo to /private/ path with optimization.

### Request

**Headers**:
```
Content-Type: multipart/form-data
x-upload-path: string (target path, e.g., /private/events/{eventId}/photos)
Authorization: Bearer <token>
```

**Body**:
```
file: <binary image data>
```

### Response

**Success (200)**:
```json
{
  "success": true,
  "data": {
    "filePath": "string (full path to optimized .webp file)",
    "thumbnailPath": "string (optional)"
  }
}
```

**Error (400)**:
```json
{
  "success": false,
  "error": "Invalid file type or size"
}
```
