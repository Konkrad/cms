# API Contract: Private Photo Access

**Endpoint**: GET `/api/events/{eventId}/photos`  
**Purpose**: List private event photos with pre-signed URLs for verified attendees

## Request

### Path Parameters
- `eventId` (string, UUID): Event identifier

### Query Parameters
- `page` (integer, optional, default: 1): Page number for pagination
- `perPage` (integer, optional, default: 50, max: 100): Photos per page

### Headers
```
Authorization: Bearer <token>
```

### Validation Rules
- User must be authenticated
- User must have participant.status = 'verified' for this event
- Event must exist

## Response

### Success (200 OK)
```json
{
  "success": true,
  "data": {
    "photos": [
      {
        "id": "string (UUID)",
        "eventId": "string (UUID)",
        "key": "string (S3 key)",
        "url": "string (pre-signed URL, 1-hour expiration)",
        "uploadedAt": "string (ISO 8601)",
        "uploadedBy": {
          "id": "string (UUID)",
          "name": "string"
        }
      }
    ],
    "pagination": {
      "page": 1,
      "perPage": 50,
      "total": 100,
      "totalPages": 2,
      "hasNext": true,
      "hasPrev": false
    }
  }
}
```

### Error Responses

#### 401 Unauthorized
```json
{
  "success": false,
  "error": "Authentication required"
}
```

#### 403 Forbidden - Not Verified Attendee
```json
{
  "success": false,
  "error": "Access denied. Only verified attendees can view event photos.",
  "message": "You must have attended the event to access private photos."
}
```

#### 404 Not Found - Event Doesn't Exist
```json
{
  "success": false,
  "error": "Event not found"
}
```

#### 404 Not Found - No Photos
```json
{
  "success": true,
  "data": {
    "photos": [],
    "pagination": {
      "page": 1,
      "perPage": 50,
      "total": 0,
      "totalPages": 0,
      "hasNext": false,
      "hasPrev": false
    }
  }
}
```

## Business Logic

1. **Access Control**:
   - Query: `SELECT status FROM participants WHERE userId = ? AND eventId = ?`
   - Require: `status = 'verified'`
   - If not verified: Return 403 Forbidden

2. **Photo Retrieval**:
   - Query: `SELECT * FROM event_photos WHERE eventId = ? ORDER BY uploadedAt DESC LIMIT ? OFFSET ?`
   - Pagination: Calculate offset from page and perPage

3. **URL Generation** (for each photo):
   - Check cache: `SELECT url, expiresAt FROM photo_access_urls WHERE photoId = ?`
   - If cached and not expired: Use cached URL
   - If not cached or expired: Generate pre-signed URL (1-hour expiration via R2 SDK)
   - Optionally cache: `INSERT INTO photo_access_urls (photoId, url, expiresAt)`

4. **Response**:
   - Return photos with pre-signed URLs
   - Include uploader name for context
   - Pagination metadata

## Rate Limiting
- 60 requests per minute per user (prevent URL farming)

## Notes
- Pre-signed URLs expire in 1 hour
- URLs can be reused within expiration window (caching recommended)
- If user bookmarks URL and it expires, they must request gallery again to get new URLs
- Photos are private: R2 bucket blocks direct public access
