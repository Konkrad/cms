# API Contracts: Product Extensions

**Base Path**: `/api/products`

## POST /api/products

Create product with participant capacity.

### Request

**Headers**:
```
Content-Type: application/json
Authorization: Bearer <token>
```

**Body**:
```json
{
  "eventId": "string (UUID, required)",
  "inventoryGroupId": "string (UUID, required)",
  "name": "string (required)",
  "price": number (required, >= 0),
  "maxQuantity": number (required, >= 0),
  "features": ["string"],
  "imageUrl": "string (optional)",
  "participantCapacity": number (optional, default 1, >= 1)
}
```

**Validation**:
- User must be event organizer
- `participantCapacity` must be positive integer >= 1
- If `participantCapacity` > 1, product requires participant data collection

### Response

**Success (201)**:
```json
{
  "success": true,
  "data": {
    "id": "string (UUID)",
    "name": "string",
    "price": number,
    "participantCapacity": number,
    "createdAt": "string (ISO 8601)"
  }
}
```

---

## PATCH /api/products/:productId

Update product including participant capacity.

### Request

**Path Parameters**:
- `productId`: string (UUID, required)

**Headers**:
```
Content-Type: application/json
Authorization: Bearer <token>
```

**Body** (all fields optional):
```json
{
  "name": "string",
  "price": number,
  "maxQuantity": number,
  "features": ["string"],
  "imageUrl": "string",
  "participantCapacity": number
}
```

**Validation**:
- User must be event organizer
- Cannot decrease `participantCapacity` below existing ticket participant counts

### Response

**Success (200)**:
```json
{
  "success": true,
  "data": {
    "id": "string (UUID)",
    "name": "string",
    "participantCapacity": number,
    "updatedAt": "string (ISO 8601)"
  }
}
```

**Error (400)**:
```json
{
  "success": false,
  "error": "Cannot reduce capacity below existing participant count"
}
```

---

## GET /api/products/:productId

Get product details.

### Request

**Path Parameters**:
- `productId`: string (UUID, required)

### Response

**Success (200)**:
```json
{
  "success": true,
  "data": {
    "id": "string (UUID)",
    "eventId": "string (UUID)",
    "name": "string",
    "price": number,
    "maxQuantity": number,
    "soldQuantity": number,
    "availableQuantity": number,
    "features": ["string"],
    "imageUrl": "string or null",
    "participantCapacity": number,
    "requiresParticipantData": boolean
  }
}
```
