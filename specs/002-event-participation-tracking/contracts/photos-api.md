# Photo Management Contracts

**Mixed Implementation**: Server functions for data operations + ONE REST API endpoint for secure file serving

## Server Functions

### createPhotoAction

**Location**: `src/routes/admin/events/[id]/photos/index.tsx`  
**Type**: `routeAction$()` with `zod$()` validation

### Input Schema (Zod)

```typescript
{
  filePath: z.string().startsWith('/private/events/').endsWith('.webp'),
  thumbnailPath: z.string().optional()
}
```

**Validation**:
- Current user must be event organizer (from session + route param)
- Event must have started (startDate <= now)

### Return Type

**Success**:
```typescript
{
  success: true,
  id: string,
  eventId: string,
  filePath: string,
  thumbnailPath: string | null,
  uploadedAt: string // ISO 8601
}
```

**Error**:
```typescript
{
  success: false,
  error: string // "Not authorized" | "Event hasn't started"
}
```

---

### getEventPhotosLoader

**Location**: `src/routes/events/[id]/photos/index.tsx`  
**Type**: `routeLoader$()`

### Input

- Route parameter: `eventId` (UUID)
- Query params: `page` (number, default 1), `limit` (number, default 20, max 100)
- Session: Current user must have attended event (ticket.scannedAt IS NOT NULL)

### Return Type

```typescript
{
  photos: Array<{
    id: string,
    thumbnailPath: string | null,
    uploadedAt: string // ISO 8601
  }>,
  pagination: {
    page: number,
    limit: number,
    total: number
  }
}
```

**Error**: Throws Qwik error (403 if not attended)

---

### generateSecurePhotoUrlAction

**Location**: `src/routes/events/[id]/photos/index.tsx`  
**Type**: `routeAction$()` with `zod$()` validation

### Input Schema (Zod)

```typescript
{
  photoId: z.string().uuid()
}
```

**Validation**:
- Current user must have attended the event associated with the photo
- Photo must exist

### Return Type

**Success**:
```typescript
{
  success: true,
  url: string, // /api/photos/serve?path=...&exp=...&sig=...
  expiresAt: string // ISO 8601 (now + 1 hour)
}
```

**Error**:
```typescript
{
  success: false,
  error: string // "Not authorized" | "Photo not found"
}
```

---

## REST API Endpoint (Required)

### GET /api/photos/serve

**Purpose**: Serve photo file with signed URL validation. This is a true REST endpoint because it needs to:
1. Serve binary file data (not JSON)
2. Work with standard HTML `<img>` tags
3. Validate HMAC signatures without session state

### Request

**Query Parameters**:
- `path`: string (required, file path e.g., `/private/events/{uuid}/photos/{uuid}.webp`)
- `exp`: string (required, Unix timestamp for expiry)
- `sig`: string (required, HMAC-SHA256 signature)
- `uid`: string (required, user ID for signature validation)

**Signature Payload**: `${path}:${uid}:${exp}` signed with `env.PHOTO_URL_SECRET`

### Response

**Success (200)**:
```
Content-Type: image/webp
Cache-Control: public, max-age=3600
ETag: <file-hash>

<binary image data>
```

**Error (403)**: Invalid or expired signature
```json
{
  "success": false,
  "error": "Invalid or expired signature"
}
```

**Error (404)**: Photo not found
```json
{
  "success": false,
  "error": "Photo not found"
}
```

**Error (410)**: URL expired
```json
{
  "success": false,
  "error": "Signed URL has expired"
}
```

---

## Upload Integration (Existing Endpoint)

### POST /api/upload

**NOTE**: This is an EXISTING REST endpoint. Documentation for integration reference.

### Request

**Headers**:
```
Content-Type: multipart/form-data
x-upload-path: string (e.g., /private/events/{eventId}/photos)
Authorization: Bearer <session-token>
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
  "filePath": "string (e.g., /private/events/{uuid}/photos/{uuid}.webp)",
  "thumbnailPath": "string (optional)"
}
```

**Used by**: PhotoUploader component (Uppy.io integration) → upload to /api/upload → call createPhotoAction with returned filePath
