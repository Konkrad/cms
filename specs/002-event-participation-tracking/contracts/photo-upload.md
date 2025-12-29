# API Contract: Photo Upload

**Endpoint**: POST `/api/events/{eventId}/photos/upload`  
**Purpose**: Upload private event photos (organizers only)

## Request

### Path Parameters
- `eventId` (string, UUID): Event identifier

### Body (multipart/form-data)
```
photo: File (required)
```

### Headers
```
Authorization: Bearer <token>
Content-Type: multipart/form-data
```

### Validation Rules
- User must be event organizer or have photo upload permissions
- File size: Max 10MB per photo
- Supported formats: JPEG, PNG, HEIC, WebP
- MIME type validation on server
- Event must exist

## Response

### Success (201 Created)
```json
{
  "success": true,
  "data": {
    "photo": {
      "id": "string (UUID)",
      "eventId": "string (UUID)",
      "key": "string (S3 key)",
      "uploadedAt": "string (ISO 8601)",
      "uploadedBy": {
        "id": "string (UUID)",
        "name": "string"
      }
    }
  },
  "message": "Photo uploaded successfully"
}
```

### Error Responses

#### 400 Bad Request - No File
```json
{
  "success": false,
  "error": "No photo file provided"
}
```

#### 400 Bad Request - Invalid Format
```json
{
  "success": false,
  "error": "Invalid file format. Supported: JPEG, PNG, HEIC, WebP"
}
```

#### 413 Payload Too Large
```json
{
  "success": false,
  "error": "File size exceeds 10MB limit"
}
```

#### 403 Forbidden - Not Organizer
```json
{
  "success": false,
  "error": "Only event organizers can upload photos"
}
```

#### 404 Not Found - Event Doesn't Exist
```json
{
  "success": false,
  "error": "Event not found"
}
```

#### 500 Internal Server Error - Upload Failed
```json
{
  "success": false,
  "error": "Failed to upload photo to storage"
}
```

## Business Logic

1. **Authorization**:
   - Query: `SELECT userId FROM events WHERE id = ?`
   - Require: `event.userId = currentUser.id` OR user has admin role

2. **File Validation**:
   - Check file size <= 10MB
   - Validate MIME type (image/jpeg, image/png, image/heic, image/webp)
   - Optionally: Scan for malware (if security requirement)

3. **Storage Upload**:
   - Generate UUID for photo ID
   - S3/R2 key: `events/{eventId}/photos/{photoId}.{ext}`
   - Upload to R2 with private ACL
   - Verify upload success

4. **Database Record**:
   - INSERT INTO event_photos (id, eventId, key, uploadedBy, uploadedAt)
   - Only create DB record if R2 upload succeeds

5. **Response**:
   - Return photo metadata
   - Do NOT return pre-signed URL (photos private by default)

## Rate Limiting
- 100 uploads per hour per organizer (prevent abuse)
- 10 concurrent uploads per organizer (prevent resource exhaustion)

## Notes
- Uploads are processed synchronously (blocking until complete)
- For batch uploads, client should make multiple requests
- Photos are private by default, accessible only to verified attendees via photo access endpoint
- No automatic thumbnail generation in MVP (can add later)
- Original filename not preserved (use UUID-based key)
