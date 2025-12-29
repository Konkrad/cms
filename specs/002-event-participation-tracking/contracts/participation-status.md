# API Contract: Participation Status Management

**Endpoint**: POST `/api/events/{eventId}/participate`  
**Purpose**: Create or update user participation status for an event

## Request

### Path Parameters
- `eventId` (string, UUID): Event identifier

### Body (JSON)
```json
{
  "status": "yes" | "no" | "maybe",
  "email": "string (optional, for user lookup/creation)",
  "name": "string (optional, for user creation)"
}
```

### Headers
```
Authorization: Bearer <token> (optional for authenticated users)
Content-Type: application/json
```

### Validation Rules
- `status`: Must be one of: "yes", "no", "maybe" (not "verified" - that's only set by scanning)
- `email`: Required if user not authenticated
- `name`: Required if user doesn't exist and needs to be created
- Event must exist

## Response

### Success (200 OK)
```json
{
  "success": true,
  "data": {
    "participant": {
      "id": "string (UUID)",
      "userId": "string (UUID)",
      "eventId": "string (UUID)",
      "status": "yes" | "no" | "maybe",
      "createdAt": "string (ISO 8601)",
      "updatedAt": "string (ISO 8601)"
    },
    "user": {
      "id": "string (UUID)",
      "email": "string",
      "name": "string"
    }
  },
  "message": "Participation status updated"
}
```

### Error Responses

#### 400 Bad Request - Invalid Status
```json
{
  "success": false,
  "error": "Invalid status value. Must be 'yes', 'no', or 'maybe'"
}
```

#### 400 Bad Request - Missing Email
```json
{
  "success": false,
  "error": "Email required for unauthenticated users"
}
```

#### 404 Not Found - Event Doesn't Exist
```json
{
  "success": false,
  "error": "Event not found"
}
```

#### 403 Forbidden - Cannot Unset Verified
```json
{
  "success": false,
  "error": "Cannot change status from 'verified'. Participant has already attended."
}
```

#### 402 Payment Required - Paid Event Requires Purchase
```json
{
  "success": false,
  "error": "This is a paid event. Please purchase a ticket to confirm attendance.",
  "data": {
    "checkoutUrl": "string (URL to checkout)"
  }
}
```

## Business Logic

### For Free Events (events.isFree = true)

1. **User Lookup/Creation**:
   - If authenticated: Use current user
   - If not authenticated: Look up user by email
   - If user doesn't exist: Create new user with provided email/name

2. **Participant Upsert**:
   - INSERT INTO participants (userId, eventId, status)
   - ON CONFLICT (userId, eventId) DO UPDATE SET status = ?, updatedAt = NOW()
   - Allow status changes: yes ↔ no ↔ maybe

3. **Ticket Generation (optional)**:
   - If status = 'yes', optionally generate ticket for scanning purposes

### For Paid Events (events.isFree = false)

1. **Status Handling**:
   - "maybe": Allow immediately, creates participant record
   - "no": Allow immediately
   - "yes": Require ticket purchase first (return 402 with checkout URL)

2. **Participant Record**:
   - "maybe" or "no": Create/update participant with specified status
   - "yes": Only allowed if user has purchased ticket (set by purchase flow)

3. **Purchase Integration**:
   - On successful payment: Automatically create participant with status = 'yes'
   - User attempting "yes" without purchase: Return 402 error

### Restrictions

- Cannot set status to 'verified' via API (only through ticket scanning)
- Cannot change status from 'verified' to anything else (terminal state)
- Validated users can only update their own participation status
- Organizers can update any participation status

## Rate Limiting
- 30 requests per minute per IP (prevent spam RSVPs)
- 100 requests per minute per authenticated user

## Notes
- Idempotent: Multiple calls with same status don't create duplicates
- For paid events, status "yes" is reserved for ticket holders
- Free events allow immediate "yes" RSVP
- Email notifications sent on status change (async, not blocking)
